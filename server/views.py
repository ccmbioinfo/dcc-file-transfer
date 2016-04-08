import glob
import os
import base64
import datetime

from flask import jsonify, make_response, request, g, render_template

from server import app
from .database import connect_db
from .utils import valid_auth_token, bam_test, get_tempdir, get_chunk_filename, gzip_test, merge_chunks, \
    remove_from_uploads, check_status, update_files_table

INVALID_AUTH_TOKEN_MSG = 'Error: Invalid transfer code'


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


@app.route("/get-auth-token", methods=['GET'])
def get_auth_token():
    # get access code from header (convert to str to fix weird encoding issue on production)
    access_code = str(request.headers['x-access-code'])
    # check if request has a recognized access code in header
    if 'x-access-code' in request.headers and access_code in app.config['ACCESS_CODES']:
        auth_token = base64.urlsafe_b64encode(os.urandom(12))
        current_date = datetime.datetime.today()
        expiry_date = current_date + datetime.timedelta(days=1)  # Code expires in 24 hours
        g.db.execute('insert into access (site_access_code,auth_token,date_created,date_expired) '
                     'values (?,?,?,?)',
                     (access_code,
                     auth_token,
                     current_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                     expiry_date.strftime("%Y-%m-%dT%H:%M:%SZ")))
        g.db.commit()
        return make_response(
            jsonify({'Access_code': auth_token, 'Expiry_date': expiry_date.strftime("%Y-%m-%dT%H:%M:%SZ")}), 200)
    else:
        return make_response(jsonify({'Error': 'unauthorized'}), 401)


@app.route("/authorize", methods=['POST'])
def authorize():
    auth_token = request.form.get('authToken', type=str)
    if valid_auth_token(auth_token):
        return make_response(jsonify({'message': 'Success: Valid transfer code'}), 200)
    else:
        return make_response(jsonify({'message': INVALID_AUTH_TOKEN_MSG}), 403)


@app.route("/upload", methods=['HEAD'])
def resumable_info():
    identifier = request.args.get('resumableIdentifier', type=str)
    filename = request.args.get('resumableFilename', type=str)
    chunk_number = request.args.get('resumableChunkNumber', type=int)
    auth_token = request.args.get('authToken', type=str, default='')

    if not all([identifier, filename, chunk_number]):
        return make_response(jsonify({'message': 'Error: missing parameter'}), 400)

    if not valid_auth_token(auth_token):
        return make_response(jsonify({'message': INVALID_AUTH_TOKEN_MSG}), 403)

    temp_dir = get_tempdir(auth_token, identifier)
    chunk_filename = get_chunk_filename(temp_dir, filename, chunk_number)

    if os.path.isfile(chunk_filename):
        # Chunk transfer completed successfully on HTTP code 200 only
        return make_response(jsonify({'message': 'Chunk already transferred'}), 200)
    else:
        # Chunk transfer not complete, send chunk requires HTTP code 204 (or anything other than 200, 400s, 500, 501)
        return make_response(jsonify({'message': 'Chunk not yet transferred'}), 204)


@app.route("/upload", methods=['POST'])
def resumable_upload():
    form_dict = {
        'chunk_number': request.form.get('resumableChunkNumber', type=int),
        'total_chunks': request.form.get('resumableTotalChunks', type=int),
        'chunk_size': request.form.get('resumableChunkSize', type=int),
        'total_size': request.form.get('resumableTotalSize', type=int),
        'identifier': request.form.get('resumableIdentifier', type=str),
        'filename': request.form.get('resumableFilename', type=str),
        'auth_token': request.form.get('authToken', type=str, default=''),
        'sample_name': request.form.get('sampleName', type=str, default=''),
        'file_type': request.form.get('fileType', type=str, default=''),
        'readset': request.form.get('readset', type=str, default=''),
        'library': request.form.get('library', type=str, default=''),
        'run_type': request.form.get('runType', type=str, default=''),
        'platform': request.form.get('platform', type=str, default=''),
        'capture_kit': request.form.get('captureKit', type=str, default=''),
        'reference': request.form.get('reference', type=str, default=''),
    }

    # Check for missing or invalid parameters
    if not all([form_dict['identifier'],
                form_dict['filename'],
                form_dict['chunk_number'],
                form_dict['chunk_size'],
                form_dict['total_chunks'],
                form_dict['total_size']]):
        return make_response(jsonify({'message': 'Error: missing parameter'}), 400)

    # Check for valid auth-token
    if not valid_auth_token(form_dict['auth_token']):
        return make_response(jsonify({'message': INVALID_AUTH_TOKEN_MSG}), 403)

    if form_dict['chunk_number'] == 1:
        # Update the db to indicate the ongoing transfer
        update_files_table(form_dict)

    input_file = request.files['file']
    temp_dir = get_tempdir(form_dict['auth_token'], form_dict['identifier'])
    chunk_filename = get_chunk_filename(temp_dir, form_dict['filename'], form_dict['chunk_number'])

    # Check that the upload_status was not changed to cancel before saving the chunk
    if check_status(form_dict['identifier']) != 'cancelled':
        if not os.path.isdir(temp_dir):
            try:
                # Create a temp directory using the unique identifier for the file
                os.makedirs(temp_dir, 0777)
            except OSError:
                # TODO: handle situation where temporary directory cannot be created on the server
                pass

        try:
            input_file.save(chunk_filename)
        except IOError:
            # TODO: handle all error types here? HTTP Error code 500 will stop the upload for now
            os.remove(chunk_filename)
            return make_response(jsonify({'message': 'Error: Chunk could not be saved'}), 500)

    all_chunks = glob.glob("{}/{}.part*".format(temp_dir, form_dict['filename']))

    # TODO: check sent file_type for BAM/SAM instead of looking at filename
    if form_dict['filename'].lower().endswith(".bam") and form_dict['chunk_number'] == form_dict['total_chunks']:
        if not bam_test(chunk_filename):
            remove_from_uploads(temp_dir)
            g.db.execute('update files set upload_status="truncated" where identifier=?',(form_dict['identifier'],))
            g.db.commit()
            return make_response(jsonify({'message': 'Error: Truncated BAM file'}), 415)

    # Merge only when all chunks are downloaded and the file has not yet been created/merged
    if len(all_chunks) == int(form_dict['total_chunks']) and \
            not os.path.isfile(os.path.join(temp_dir, form_dict['filename'])):
        if merge_chunks(all_chunks, form_dict['filename']):
            if form_dict['filename'].lower().endswith(".gz") and \
                    not gzip_test(os.path.join(temp_dir, form_dict['filename'])):
                remove_from_uploads(temp_dir)
                g.db.execute('update files set upload_status="truncated" where identifier=?',
                             (form_dict['identifier'],))
                g.db.commit()
                return make_response(jsonify({'message': 'Error: Truncated GZIP file'}), 415)
            elif os.path.getsize(os.path.join(temp_dir, form_dict['filename'])) != form_dict['total_size']:
                 return make_response(jsonify({'message': 'Error: Inconsistent final file size'}), 415)

            # Update db on file completion
            # TODO: associate file with user/owner and include file metadata
            current_date = datetime.datetime.today().strftime("%Y-%m-%dT%H:%M:%SZ")
            g.db.execute('update files set date_upload_end=? where identifier=?',
                         (current_date, form_dict['identifier']))
            g.db.execute('update files set upload_status="complete" where identifier=?', (form_dict['identifier'],))
            g.db.commit()
            return make_response(jsonify({'Download complete': 'Successfully received file'}), 200)
        else:
            return make_response(jsonify({'message': 'Error: File could not be saved'}), 500)

    return make_response(jsonify({'Download complete': 'Successfully received chunk'}), 200)


@app.route("/cancel", methods=['POST'])
def cancel_upload():
    identifier = request.form.get('resumableIdentifier', type=str)
    auth_token = request.form.get('authToken', type=str, default='')

    if not all([identifier, auth_token]):
        return make_response(jsonify({'message': 'Error: missing parameter'}), 400)

    if not valid_auth_token(auth_token):
        return make_response(jsonify({'message': INVALID_AUTH_TOKEN_MSG}), 403)

    if check_status(identifier) != 'complete':
        remove_from_uploads(get_tempdir(auth_token, identifier))
        g.db.execute('update files set upload_status="cancelled" where identifier=?', (identifier,))
        g.db.commit()

    return make_response(jsonify({'message': 'Cancel received'}), 200)
