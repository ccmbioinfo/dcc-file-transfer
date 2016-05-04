import gzip
import hashlib
import os
import base64
import datetime as dt

from glob import glob

from flask import jsonify, make_response

from server import app, db
from models import User, Access, File


CHUNK_PREFIX = 'chunk.'


def generate_auth_token(server_token, user, name=None, email=None, duration_days=1):
    auth_token = base64.urlsafe_b64encode(os.urandom(12))
    server_name = app.config['SERVER_TOKENS'][server_token]['name']
    server_id = app.config['SERVER_TOKENS'][server_token]['id']
    current_date = dt.datetime.today()
    expiry_date = current_date + dt.timedelta(duration_days)  # Code expires in 24 hours by default

    new_user = User(server_id=server_id, server_name=server_name, user_id=user, user_name=name, user_email=email)
    new_access = Access(server_id=server_id, server_name=server_name, user_id=user, auth_token=auth_token,
                        date_created=current_date, date_expired=expiry_date)

    db.session.add_all([new_user, new_access])
    db.session.commit()

    return auth_token, expiry_date


def get_auth_status(auth_token):
    current_time = dt.datetime.today()
    access = Access.query.filter_by(auth_token=auth_token).first()
    if not access:
        return 'not found'
    if current_time > access.date_expired:
        return 'expired'

    return 'valid'


def get_auth_response(auth_status):
    if auth_status == 'valid':
        return make_response(jsonify({'message': 'Success: Valid transfer code'}), 200)
    elif auth_status == 'expired':
        return make_response(jsonify({'message': 'Error: Transfer code has expired'}), 410)
    elif auth_status == 'not found':
        return make_response(jsonify({'message': 'Error: Transfer code does not exist'}), 404)
    else:
        return make_response(jsonify({'message': 'Error: Unexpected authentication status'}), 500)


def allowed_file(filename):
    suffix = os.path.splitext(filename)[1].lower()
    return suffix in app.config['ALLOWED_EXTENSIONS']


def bam_test(data):
    bam_eof = \
        '\x1f\x8b\x08\x04\x00\x00\x00\x00\x00\xff\x06\x00BC\x02\x00\x1b\x00\x03\x00\x00\x00\x00\x00\x00\x00\x00\x00'
    with open(data, 'rb') as f:
        f.seek(-28, 2)
        return f.read() == bam_eof


def md5_test(checksum, filename):
    md5 = hashlib.md5()
    with open(filename, 'rb') as f:
        for chunk in iter(lambda: f.read(128 * md5.block_size), b''):
            md5.update(chunk)
    return checksum == md5.hexdigest()


def is_gzip_file(filename):
    suffix = os.path.splitext(filename)[1].lower()
    return suffix in ['.gz', '.tgz']


def gzip_test(filename):
    try:
        with gzip.open(filename, 'rb') as f:
            f.read(1024 * 1024)
        return True
    except IOError:
        return False


def get_tempdir(*args):
    path = app.config['UPLOAD_FOLDER']
    for subdir in list(args):
        path = os.path.join(path, subdir)
    return path


def get_chunk_filename(temp_dir, chunk_number):
    return os.path.join(temp_dir, "{}{:08d}".format(CHUNK_PREFIX, chunk_number))


def get_file_chunks(temp_dir):
    return glob(os.path.join(temp_dir, "{}*".format(CHUNK_PREFIX)))


def merge_chunks(chunk_paths, filename):
    chunk_paths.sort()
    output_file = os.path.join(os.path.dirname(os.path.realpath(chunk_paths[0])), filename)
    try:
        with open(output_file, 'wb') as OUTPUT:
            for path in chunk_paths:
                with open(path, 'rb') as INPUT:
                    OUTPUT.write(INPUT.read())

        app.logger.info('Merged chunks -> %s', output_file)
        # Indicate that file merged successfully
        return True
    except IOError:
        try:
            os.remove(output_file)
        except OSError:
            pass

    return False


def generate_file(data):
    temp_dir = get_tempdir(data['auth_token'], data['identifier'])
    all_chunks = get_file_chunks(temp_dir)

    # Check for all chunks and that the file doesn't already exists
    if not os.path.isfile(os.path.join(temp_dir, data['filename'])):
        # Attempt to merge all chunks
        success = merge_chunks(all_chunks, data['filename'])
        if not success:
            update_file_status(data['identifier'], 'unmerged')
            return make_response(jsonify({'message': 'Error: File could not be merged'}), 500)

    # Check for GZIP and perform integrity test
    if is_gzip_file(data['filename']) and not gzip_test(os.path.join(temp_dir, data['filename'])):
        remove_from_uploads(temp_dir)
        update_file_status(data['identifier'], 'corrupt')
        return make_response(jsonify({'message': 'Error: Truncated GZIP file'}), 415)

    # Ensure the final file size on disk matches the expected size from the client
    if os.path.getsize(os.path.join(temp_dir, data['filename'])) != data['total_size']:
        return make_response(jsonify({'message': 'Error: Inconsistent final file size'}), 415)

    update_file_status(data['identifier'], 'complete')
    return make_response(jsonify({'message': 'Success: File upload completed successfully'}), 200)


def remove_from_uploads(tempdir):
    try:
        all_chunks = os.listdir(tempdir)
        for chunk in all_chunks:
            os.remove(os.path.join(tempdir, chunk))
        os.rmdir(tempdir)
    except OSError:
        pass


def get_user_files(user_id, status):
    files = File.query.filter_by(user_id=user_id, upload_status=status).all()
    db_files = {}
    for row in files:
        db_files[row.identifier] = {
                'identifier': row.identifier,
                'sample-name': row.sample_name,
                'filename': row.filename,
                'type': row.file_type,
                'readset': row.readset,
                'platform': row.platform,
                'run-type': row.run_type,
                'capture-kit': row.capture_kit,
                'library': row.library,
                'reference': row.reference
            }
    return db_files


def get_user_by_auth_token(auth_token):
    return Access.query.filter_by(auth_token=auth_token).first().user_id


def insert_new_file(data):
    file_row = File.query.filter_by(identifier=data['identifier']).first()
    if not file_row:
        file_row = File()

    file_row.server_id = Access.query.filter_by(auth_token=data['auth_token']).first().server_id
    file_row.user_id = Access.query.filter_by(auth_token=data['auth_token']).first().user_id
    file_row.identifier = data['identifier']
    file_row.sample_name = data['sample_name']
    file_row.auth_token = data['auth_token']
    file_row.total_size = data['total_size']
    file_row.filename = data['filename']
    file_row.file_type = data['file_type']
    file_row.readset = data['readset']
    file_row.library = data['library']
    file_row.run_type = data['run_type']
    file_row.platform = data['platform']
    file_row.capture_kit = data['capture_kit']
    file_row.reference = data['reference']
    file_row.upload_status = 'ongoing'
    file_row.date_upload_start = dt.datetime.today()

    db.session.add(file_row)
    db.session.commit()


def update_file_status(identifier, status):
    file_row = File.query.filter_by(identifier=identifier).first()
    if file_row:
        file_row.upload_status = status

        if status != 'ongoing':
            file_row.date_upload_end = dt.datetime.today()

        db.session.add(file_row)
        db.session.commit()
