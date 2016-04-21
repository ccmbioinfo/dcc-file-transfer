import os

from flask import jsonify, make_response, request, g, render_template

from server import app
from .database import connect_db
from .utils import generate_auth_token, get_auth_status, get_auth_response, bam_test, get_tempdir, get_chunk_filename, \
    generate_file, remove_from_uploads, get_file_data, get_files_by_status, insert_file_metadata, update_file_metadata,\
    update_file_status


def return_message(message, status_code):
    return make_response(jsonify({'message': message}), status_code)


def return_data(data, status_code=200):
    return make_response(jsonify(data), status_code)


@app.before_request
def before_request():
    # connect to the database before processing a request
    g.db = connect_db()


@app.teardown_request
def teardown_request(exception):
    # close the database connection regardless of request outcome
    db = getattr(g, 'db', None)
    if db is not None:
        db.close()


@app.route("/", methods=['GET'])
def home():
    return render_template('home.html')


@app.route("/transfers/", methods=['POST'])
def create_auth_token():
    # get server token from header (convert to str to fix weird encoding issue on production)
    server_token = request.headers.get('X-Server-Token', type=str)
    user = request.headers.get('X-User', type=str)
    name = request.headers.get('X-Name', type=str)
    email = request.headers.get('X-Email', type=str)
    duration = request.headers.get('X-Duration', type=int)

    if not all([server_token, user]):
        return return_message('Error: missing parameter', 400)

    if server_token and server_token in app.config['SERVER_TOKENS']:
        auth_token, expiry_date = generate_auth_token(server_token, user, name, email, duration)
        return return_data({'User': user,
                            'Transfer Code': auth_token,
                            'Expires On': expiry_date.strftime("%Y-%m-%dT%H:%M:%SZ")})

    return return_message('Error: Unauthorized', 401)


@app.route("/transfers/<auth_token>", methods=['GET'])
def authorize(auth_token):
    auth_token = request.args.get('authToken', type=str)
    return get_auth_response(get_auth_status(auth_token))


@app.route("/transfers/<auth_token>/samples/", methods=['GET'])
def get_samples(auth_token):
    # The status argument can be used to retrieve files that are complete, corrupt, or ongoing
    status = request.args.get('status', type=str)
    if get_auth_status(auth_token) != 'valid':
        return get_auth_response(auth_token)

    return return_data(get_files_by_status(auth_token, status))


@app.route("/transfers/<auth_token>/samples/<sample_name>/files/<identifier>", methods=['PUT'])
def update_upload_status(auth_token, sample_name, identifier):
    data = {
        'status': request.form.get('status', type=str),
        'identifier': str(identifier),
        'sample_name': str(sample_name),
        'auth_token': str(auth_token),
        'total_chunks': request.form.get('flowTotalChunks', type=int),
        'total_size': request.form.get('flowTotalSize', type=int),
        'filename': request.form.get('flowFilename', type=str),
        'file_type': request.form.get('fileType', type=str, default=''),
        'readset': request.form.get('readset', type=str, default=''),
        'library': request.form.get('library', type=str, default=''),
        'run_type': request.form.get('runType', type=str, default=''),
        'platform': request.form.get('platform', type=str, default=''),
        'capture_kit': request.form.get('captureKit', type=str, default=''),
        'reference': request.form.get('reference', type=str, default=''),
    }

    if data['status'] == 'start':
        if get_file_data(identifier, 'upload_status') == 'complete':
            return return_message('Error: File already uploaded', 400)

        insert_file_metadata(data)
        return return_message('Success: Upload set to ongoing in db', 200)

    elif data['status'] == 'complete':
        return generate_file(data)

    return return_message('Error: Unexpected status', 400)


@app.route("/transfers/<auth_token>/samples/<sample_name>/files/<identifier>", methods=['DELETE'])
def cancel_upload(auth_token, sample_name, identifier):
    if get_auth_status(auth_token) != 'valid':
        return get_auth_response(auth_token)

    if not get_file_data(identifier, 'upload_status'):
        return return_message('Error: Identifier does not exist', 404)

    if get_file_data(identifier, 'upload_status') != 'complete':
        update_file_status(identifier, 'cancelled')
        remove_from_uploads(get_tempdir(auth_token, identifier))
        return return_message('Success: Cancel received', 200)

    return return_message('Error: Upload already complete', 400)


@app.route("/transfers/<auth_token>/samples/<sample_name>/files/<identifier>/chunks/<chunk_number>", methods=['HEAD'])
def chunk_info(auth_token, sample_name, identifier, chunk_number):
    try:
        chunk_number = int(chunk_number)
    except ValueError:
        return return_message('Error: invalid chunk number', 400)

    if get_auth_status(auth_token) != 'valid':
        return get_auth_response(auth_token)

    temp_dir = get_tempdir(auth_token, identifier)
    chunk_filename = get_chunk_filename(temp_dir, chunk_number)
    if os.path.isfile(chunk_filename):
        # Chunk transfer completed successfully on HTTP code 200 only
        return return_message('Chunk already transferred', 200)
    # Chunk transfer not complete, send chunk requires HTTP code 204 (or anything other than 200, 400s, 500, 501)
    return return_message('Chunk not yet transferred', 204)


@app.route("/transfers/<auth_token>/samples/<sample_name>/files/<identifier>/chunks/<chunk_number>", methods=['PUT'])
def chunk_upload(auth_token, sample_name, identifier, chunk_number):
    if get_auth_status(auth_token) != 'valid':
        return get_auth_response(auth_token)

    filename = request.form.get('flowFilename', type=str)
    total_chunks = request.form.get('flowTotalChunks', type=int)

    try:
        chunk_number = int(chunk_number)
    except ValueError:
        return return_message('Error: invalid chunk number', 400)

    if not all([filename, total_chunks]):
        return return_message('Error: missing parameter', 400)

    if get_file_data(identifier, 'upload_status') != 'ongoing':
        return return_message('Error: Chunk refused, file status not set to ongoing', 202)

    input_chunk = request.files['file']
    temp_dir = get_tempdir(auth_token, identifier)
    chunk_filename = get_chunk_filename(temp_dir, chunk_number)

    if not os.path.isdir(temp_dir):
        try:
            os.makedirs(temp_dir, 511)  # rwxrwxrwx (octal: 777)
        except OSError:
            return return_message('Error: File directory could not be created', 500)

    try:
        input_chunk.save(chunk_filename)
    except IOError:
        os.remove(chunk_filename)
        return return_message('Error: Chunk could not be saved', 500)

    # BAM test for integrity done here since only the prioritized last chunk is needed to determine corruption
    if chunk_number == total_chunks and get_file_data(identifier, 'file_type') == 'BAM/SAM':
        if not bam_test(chunk_filename):
            remove_from_uploads(temp_dir)
            update_file_status(identifier, 'corrupt')
            return return_message('Error: Truncated BAM file', 415)

    return return_message('Success: Upload of chunk complete', 200)
