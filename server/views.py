import os
from functools import wraps

from flask import request, render_template
from server import app
from server.models import File
from server.utils import generate_auth_token, get_auth_status, get_auth_response, validate_bam, \
    get_tempdir, get_chunk_filename, generate_file, remove_from_uploads, get_user_files, \
    get_or_create_file, update_file_status, get_user_by_auth_token, InvalidServerToken, \
    return_data, return_message, make_tempdir, InvalidFileSize, DirectoryCreationError, TruncatedBam, \
    get_files, update_file, InvalidColumnName


@app.errorhandler(500)
def internal_server_error(error):
    app.logger.error(error)
    return return_message('Error: Caught an internal server error', 500)


@app.errorhandler(404)
def page_not_found(error):
    app.logger.error(error)
    return return_message('This page does not exist', 404)


@app.errorhandler(400)
def bad_request(error):
    app.logger.error(error)
    return return_message('Bad request', 400)


def valid_auth_token_required(func):
    @wraps(func)
    def auth_token_validation(auth_token, *args, **kwargs):
        auth_status = get_auth_status(auth_token)
        if auth_status != 'valid':
            return get_auth_response(auth_status)
        return func(auth_token, *args, **kwargs)
    return auth_token_validation


@app.route("/", methods=['GET'])
def home():
    return render_template('home.html')


@app.route("/db/files", methods=['GET'])
def get_db_files():
    # get server token from header (convert to str to fix weird encoding issue on production)
    server_token = request.headers.get('X-Server-Token', type=str)

    json_data = request.get_json()

    try:
        if json_data:
            column = json_data.get('column')
            value = json_data.get('value')
            if not all([column, value]):
                return return_message('Error: missing parameter', 400)
            data = get_files(server_token, str(column), str(value))
        else:
            data = get_files(server_token)
        return return_data(data)

    except InvalidServerToken:
        return return_message('Error: Unauthorized', 401)
    except InvalidColumnName:
        return return_message('Error: Column name does not exist', 400)


@app.route("/db/files/<identifier>", methods=['PUT'])
def update_db_file(identifier):
    # get server token from header (convert to str to fix weird encoding issue on production)
    server_token = request.headers.get('X-Server-Token', type=str)

    json_data = request.get_json()

    column = json_data.get('column')
    value = json_data.get('value')
    if not all([column, value]):
        return return_message('Error: missing parameter', 400)

    try:
        return update_file(server_token, identifier, str(column), str(value))
    except InvalidServerToken:
        return return_message('Error: Unauthorized', 401)


@app.route("/transfers/", methods=['POST'])
def create_auth_token():
    # get server token from header (convert to str to fix weird encoding issue on production)
    server_token = request.headers.get('X-Server-Token', type=str)

    json_data = request.get_json()

    try:
        user = str(json_data.get('user'))
    except AttributeError:
        return return_message('Error: missing user', 400)

    name = str(json_data.get('name', ''))
    email = str(json_data.get('email', ''))
    duration = int(json_data.get('duration', 1))

    if not all([server_token, user]):
        return return_message('Error: missing parameter', 400)
    if user.find('/') != -1:
        return return_message('Error: invalid username, must not contain "/"', 400)

    try:
        auth_token, expiry_date = generate_auth_token(server_token, user, name, email, duration)
        return return_data({'user': user,
                            'transferCode': auth_token,
                            'expiresAt': expiry_date.strftime("%Y-%m-%dT%H:%M:%SZ")})
    except InvalidServerToken:
        return return_message('Error: Unauthorized', 401)


@app.route("/transfers/<auth_token>", methods=['GET'])
def authorize(auth_token):
    auth_token = str(auth_token)
    return get_auth_response(get_auth_status(auth_token))


@app.route("/transfers/<auth_token>/samples/", methods=['GET'])
@valid_auth_token_required
def get_samples(auth_token):
    auth_token = str(auth_token)
    # The status argument can be used to retrieve files that are complete, corrupt, or ongoing
    status = request.args.get('status', type=str)
    user_id = get_user_by_auth_token(auth_token)
    return return_data(get_user_files(user_id, status))


@app.route("/transfers/<auth_token>/samples/<sample_name>/files/<identifier>", methods=['PUT'])
@valid_auth_token_required
def update_upload_status(auth_token, sample_name, identifier):
    auth_token = str(auth_token)
    sample_name = str(sample_name)
    identifier = str(identifier)
    data = {
        'status': request.form.get('status', type=str),
        'identifier': identifier,
        'sample_name': sample_name,
        'auth_token': auth_token,
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
        file_row = File.query.filter_by(identifier=identifier).first()
        if file_row and file_row.upload_status == 'complete':
            return return_message('Error: File already uploaded', 400)

        get_or_create_file(data)
        return return_message('Success: Upload set to ongoing in db', 200)

    elif data['status'] == 'complete':
        return generate_file(data)

    return return_message('Error: Unexpected status', 400)


@app.route("/transfers/<auth_token>/samples/<sample_name>/files/<identifier>", methods=['DELETE'])
@valid_auth_token_required
def cancel_upload(auth_token, sample_name, identifier):
    auth_token = str(auth_token)
    sample_name = str(sample_name)
    identifier = str(identifier)

    file_row = File.query.filter_by(identifier=identifier).first()

    if not file_row:
        return return_message('Error: Identifier does not exist', 404)

    if file_row.upload_status != 'complete':
        update_file_status(identifier, 'cancelled')
        remove_from_uploads(get_tempdir(auth_token, identifier))
        return return_message('Success: Cancel received', 200)

    return return_message('Error: Upload already complete', 400)


@app.route("/transfers/<auth_token>/samples/<sample_name>/files/<identifier>/chunks/<chunk_number>", methods=['HEAD'])
@valid_auth_token_required
def chunk_info(auth_token, sample_name, identifier, chunk_number):
    auth_token = str(auth_token)
    sample_name = str(sample_name)
    identifier = str(identifier)
    try:
        chunk_number = int(chunk_number)
    except ValueError:
        return return_message('Error: invalid chunk number', 400)

    temp_dir = get_tempdir(auth_token, identifier)
    chunk_filename = get_chunk_filename(temp_dir, chunk_number)
    if os.path.isfile(chunk_filename):
        # Chunk transfer completed successfully on HTTP code 200 only
        return return_message('Chunk already transferred', 200)
    # Chunk transfer not complete, send chunk requires HTTP code 204 (or anything other than 200, 400s, 500, 501)
    return return_message('Chunk not yet transferred', 204)


@app.route("/transfers/<auth_token>/samples/<sample_name>/files/<identifier>/chunks/<chunk_number>", methods=['PUT'])
@valid_auth_token_required
def chunk_upload(auth_token, sample_name, identifier, chunk_number):
    auth_token = str(auth_token)
    sample_name = str(sample_name)
    identifier = str(identifier)
    file = File.query.filter_by(identifier=identifier).first()

    try:
        chunk_number = int(chunk_number)
    except ValueError:
        return return_message('Error: invalid chunk number', 400)

    filename = request.form.get('flowFilename', type=str)
    total_chunks = request.form.get('flowTotalChunks', type=int)
    current_chunk_size = request.form.get('flowCurrentChunkSize', type=int)
    input_chunk = request.files['file']

    if not all([filename, total_chunks, current_chunk_size]):
        return return_message('Error: missing parameter', 400)

    if not file or file.upload_status != 'ongoing':
        return return_message('Error: Chunk refused, file status not set to ongoing', 202)

    temp_dir = get_tempdir(auth_token, identifier)
    chunk_filename = get_chunk_filename(temp_dir, chunk_number)

    try:
        make_tempdir(temp_dir)
    except DirectoryCreationError:
        return return_message('Error: File directory could not be created', 500)

    try:
        input_chunk.save(chunk_filename)
        if os.path.getsize(chunk_filename) != current_chunk_size:
            raise InvalidFileSize
        # BAM test for integrity done here since only the prioritized last chunk is needed to determine corruption
        if chunk_number == total_chunks and file.file_type == 'BAM/SAM':
            validate_bam(chunk_filename)
    except TruncatedBam:
        remove_from_uploads(temp_dir)
        update_file_status(identifier, 'corrupt')
        return return_message('Error: Truncated BAM file', 415)
    except InvalidFileSize:
        os.remove(chunk_filename)
        return return_message('Error: Chunk size on disk does not match', 500)
    except:
        os.remove(chunk_filename)
        return return_message('Error: Chunk could not be saved', 500)

    return return_message('Success: Upload of chunk complete', 200)
