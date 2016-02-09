import glob
import os

from flask import jsonify, make_response, request, g, render_template

from server import app
from .database import connect_db
from .utils import allowed_file, merge_chunks


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


@app.route("/upload", methods=['GET'])
def transfer_info():
    identifier = request.args.get('resumableIdentifier', type=str)
    filename = request.args.get('resumableFilename', type=str)
    chunk_number = request.args.get('resumableChunkNumber', type=int)

    if not identifier or not filename or not chunk_number:
        return make_response(jsonify({'Error': 'Missing parameter error'}), 400)

    temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], identifier)
    chunk_file = "{}/{}.part{}".format(temp_dir, filename, chunk_number)

    if os.path.isfile(os.path.join(temp_dir, chunk_file)):
        return make_response(jsonify({'Download complete': 'Chunk already received successfully'}), 200)
    else:
        return make_response(jsonify({'Error': 'Chunk was not found!'}), 404)


@app.route("/upload", methods=['POST'])
def resumable_upload():
    chunk_number = request.form.get('resumableChunkNumber', type=int)
    total_chunks = request.form.get('resumableTotalChunks', type=int)
    chunk_size = request.form.get('resumableChunkSize', type=int)
    total_size = request.form.get('resumableTotalSize', type=int)
    identifier = request.form.get('resumableIdentifier', type=str)
    filename = request.form.get('resumableFilename', type=str)


    # Check for missing or invalid parameters
    if not identifier or not filename or not chunk_number or not chunk_size or not total_chunks or not total_size:
        return make_response(jsonify({'Error': 'Missing parameter error'}), 400)

    # Check for accepted filetype
    if not allowed_file(filename):
        return make_response(jsonify({'Error': 'Invalid file type'}), 415)

    # Create a temp directory using the unique identifier for the file
    temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], identifier)

    if not os.path.isdir(temp_dir):
        os.makedirs(temp_dir, 0777)

    chunk_filename = "{}/{}.part{:08d}".format(temp_dir, filename, chunk_number)
    app.logger.debug('Uploading chunk %s/%s for %s -> %s', chunk_number, total_chunks, filename, chunk_filename)

    input_file = request.files['file']
    input_file.save(chunk_filename)

    all_chunks = glob.glob("{}/{}.part*".format(temp_dir, filename))

    if len(all_chunks) == int(total_chunks):
        merge_chunks(all_chunks, filename)
        return make_response(jsonify({'Download complete': 'Successfully received file'}), 200)

    return make_response(jsonify({'Download complete': 'Successfully received chunk'}), 200)

    # if file_complete:
    #     file_type = base_filename.rsplit('.', 1)[1].lower()
    #     if file_type == 'bam':
    #         passed_integrity_check = bam_test(os.path.join(app.config['UPLOAD_FOLDER'], base_filename))
    #     else:  # file is therefore *.gz
    #         passed_integrity_check = gzip_test(os.path.join(app.config['UPLOAD_FOLDER'], base_filename))
    #
    #     passed_md5_check = md5_test(header['X-MD5-Checksum'], os.path.join(app.config['UPLOAD_FOLDER'], base_filename))
    #
    #     if passed_md5_check and passed_integrity_check:
    #         return make_response(jsonify({'Download complete': 'Successfully received file'}))
    #     else:
    #         return make_response(jsonify({'Download complete': 'ERROR, the received file is corrupt or incomplete!'}))
    #
    #         # TODO: update database with file and owner


@app.route('/users', methods=['GET'])
def show_users():
    cur = g.db.execute('select * from users order by user_id asc')
    users = cur.fetchall()
    return make_response(str(users))


@app.route('/user/<username>')
def show_user_files(username):
    # query db to check for appropriate auth-token
    # if matched, return user_ID and query for a list of all their files
    # show the user their available files
    return 'User %s' % username


