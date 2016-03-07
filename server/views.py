import glob
import os
import uuid
import datetime

from flask import jsonify, make_response, request, g, render_template

from server import app
from .database import connect_db
from .utils import allowed_file, bam_test, get_tempdir, get_chunk_filename, gzip_test, merge_chunks

INVALID_AUTH_TOKEN_MSG = 'Error: Invalid transfer code'

@app.before_request
def before_request():
    # connect to the database before processing a request
    # foreign key constraints need to be turned on with each connection
    g.db = connect_db()
    g.db.execute("PRAGMA foreign_keys=ON")
    g.db.commit()


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
    # check if request has a recognized access code in header
    if 'x-access-code' in request.headers and request.headers['x-access-code'] in app.config['ACCESS_CODES']:
        auth_token = uuid.uuid4().hex
        current_date = datetime.datetime.today()
        expiry_date = current_date + datetime.timedelta(days=1)  # Code expires in 24 hours
        g.db.execute('insert into access (site_access_code,auth_token,date_created,date_expired) '
                     'values ("%s","%s","%s","%s")' % (request.headers['x-access-code'],
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
    current_time = datetime.datetime.today()
    expiry_date = g.db.execute('select date_expired from access where auth_token = "%s"' % auth_token).fetchone()

    if expiry_date:
        expiry_date = datetime.datetime.strptime(expiry_date[0], "%Y-%m-%dT%H:%M:%SZ")
        if current_time <= expiry_date:
            return make_response(jsonify({'message': 'Success: Valid transfer code'}), 200)
        else:
            return make_response(jsonify({'message': 'Error: Expired transfer code'}), 403)
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

    if auth_token != app.config['AUTH_TOKEN']:
        return make_response(jsonify({'message': INVALID_AUTH_TOKEN_MSG}), 403)

    temp_dir = get_tempdir(identifier)
    chunk_filename = get_chunk_filename(temp_dir, filename, chunk_number)

    if os.path.isfile(chunk_filename):
        return make_response(jsonify({'message': 'Chunk already transferred'}), 200)
    else:
        return make_response(jsonify({'message': 'Chunk not yet transferred'}), 204)


@app.route("/upload", methods=['POST'])
def resumable_upload():
    chunk_number = request.form.get('resumableChunkNumber', type=int)
    total_chunks = request.form.get('resumableTotalChunks', type=int)
    chunk_size = request.form.get('resumableChunkSize', type=int)
    total_size = request.form.get('resumableTotalSize', type=int)
    identifier = request.form.get('resumableIdentifier', type=str)  # assumes this is unique per file not chunk!
    filename = request.form.get('resumableFilename', type=str)
    auth_token = request.form.get('authToken', type=str, default='')

    # Check for missing or invalid parameters
    if not all([identifier, filename, chunk_number, chunk_size, total_chunks, total_size]):
        return make_response(jsonify({'message': 'Error: missing parameter'}), 400)

    if auth_token != app.config['AUTH_TOKEN']:
        return make_response(jsonify({'message': INVALID_AUTH_TOKEN_MSG}), 403)

    # Create a temp directory using the unique identifier for the file
    temp_dir = get_tempdir(identifier)

    if not os.path.isdir(temp_dir):
        os.makedirs(temp_dir, 0777)

    chunk_filename = get_chunk_filename(temp_dir, filename, chunk_number)

    input_file = request.files['file']
    input_file.save(chunk_filename)

    all_chunks = glob.glob("{}/{}.part*".format(temp_dir, filename))

    if filename.lower().endswith(".bam") and chunk_number == total_chunks:
        if not bam_test(chunk_filename):
            os.remove(chunk_filename)
            return make_response(jsonify({'message': 'Error: BAM file appears to be truncated'}), 415)

    if len(all_chunks) == int(total_chunks):
        merge_chunks(all_chunks, filename)

        if filename.lower().endswith(".gz") and not gzip_test(os.path.join(temp_dir, filename)):
            os.remove(get_chunk_filename(temp_dir, filename, total_chunks))
            return make_response(jsonify({'message': 'Error: GZIP file appears to be truncated'}), 415)

        # add file to database TODO associate file with user/owner and include file metadata
        # g.db.execute('insert into files (filename) values ("%s")' % filename)
        # g.db.commit()
        return make_response(jsonify({'Download complete': 'Successfully received file'}), 200)

    return make_response(jsonify({'Download complete': 'Successfully received chunk'}), 200)


@app.route('/users', methods=['GET'])
def show_users():
    users = g.db.execute('select * from users order by user_id asc').fetchall()
    return make_response(jsonify({t[0]: t[1:] for t in users}))


@app.route('/user/<username>', methods=['GET'])
def show_user_files(username):
    # query db to check for appropriate auth-token first?
    user_files = g.db.execute('select * from files where owner = "%s"' % username).fetchall()
    return make_response(jsonify({t[0]: t[1:] for t in user_files}))
