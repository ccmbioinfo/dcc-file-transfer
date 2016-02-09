from server import app
import os
import glob
import sqlite3
import hashlib
import gzip
import json
from flask import jsonify, make_response, request, g
from contextlib import closing


def connect_db():
    # connection to the database path
    return sqlite3.connect(app.config['DATABASE'])


def init_db():
    # initalize the database if it doesn't already exist.
    # this step needs to be run manually from the command line
    # from server import views; views.init_db()
    with closing(connect_db()) as db:
        with open(app.config['SCHEMA'], mode='r') as f:
            db.cursor().executescript(f.read())
        db.commit()


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


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


def bam_test(filename):
    bam_eof = \
        '\x1f\x8b\x08\x04\x00\x00\x00\x00\x00\xff\x06\x00BC\x02\x00\x1b\x00\x03\x00\x00\x00\x00\x00\x00\x00\x00\x00'
    with open(filename, 'rb') as f:
        f.seek(-28, 2)
        return f.read() == bam_eof


def gzip_test(filename):
    try:
        with gzip.open(filename, 'rb') as f:
            f.read(1024 * 1024)
        return True
    except IOError:
        return False


def md5_test(checksum, filename):
    md5 = hashlib.md5()
    with open(filename, 'rb') as f:
        for chunk in iter(lambda: f.read(128 * md5.block_size), b''):
            md5.update(chunk)
    return checksum == md5.hexdigest()


def merge_chunks(file_chunks, output_name):
    file_chunks.sort()
    output_path = os.path.dirname(os.path.realpath(file_chunks[0]))
    with open(os.path.join(output_path, output_name), 'ab') as OUTPUT:
        for chunk in file_chunks:
            with open(chunk, 'r') as INPUT:
                OUTPUT.seek(0, 2)
                OUTPUT.write(INPUT.read())
    for chunk in file_chunks:
        os.remove(chunk)


@app.route("/upload", methods=['GET'])
def resumable_info():
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
    identifier = request.form.get('resumableIdentifier', type=str)  # assumes this is unique per file not chunk!
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

    chunk_file = "{}/{}.part{}".format(temp_dir, filename, chunk_number)

    input_file = request.files['file']
    input_file.save(chunk_file)

    all_chunks = glob.glob(temp_dir + '/' + filename + ".*")

    if len(all_chunks) == int(total_chunks):
        merge_chunks(all_chunks, filename)
        # TODO integrity check (md5, .gz/.bam)
        # add file to database TODO associate file with user/owner and include file metadata
        g.db.execute('insert into files (filename) values ("%s")' % filename)
        g.db.commit()
        return make_response(jsonify({'Download complete': 'Successfully received file'}), 200)

    return make_response(jsonify({'Download complete': 'Successfully received chunk'}), 200)


@app.route('/users', methods=['GET'])
def show_users():
    users = g.db.execute('select * from users order by user_id asc').fetchall()
    return make_response(jsonify({t[0]:t[1:] for t in users}))


@app.route('/user/<username>', methods=['GET'])
def show_user_files(username):
    # query db to check for appropriate auth-token first?
    user_files = g.db.execute('select * from files where owner = "%s"' % username).fetchall()
    return make_response(jsonify({t[0]:t[1:] for t in user_files}))

