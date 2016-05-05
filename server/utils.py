import gzip
import hashlib
import os
import base64
import datetime as dt

from glob import glob

from flask import jsonify, make_response, g

from server import app


CHUNK_PREFIX = 'chunk.'


def generate_auth_token(server_token, user, name=None, email=None, duration_days=1):
    auth_token = base64.urlsafe_b64encode(os.urandom(12))
    current_date = dt.datetime.today()
    expiry_date = current_date + dt.timedelta(duration_days)  # Code expires in 24 hours by default
    save_auth_token(server_token, user, name, email, auth_token, current_date, expiry_date)
    return auth_token, expiry_date


def save_auth_token(server_token, user, name, email, auth_token, date_created, expiry_date):
    server_name = app.config['SERVER_TOKENS'][server_token]['name']
    server_id = app.config['SERVER_TOKENS'][server_token]['id']
    g.db.execute('insert into access (server_name, server_id, user_id, auth_token, date_created, date_expired) '
                 'values (?,?,?,?,?,?)',
                 (server_name, server_id, user, auth_token, date_created.strftime("%Y-%m-%dT%H:%M:%SZ"), expiry_date.strftime("%Y-%m-%dT%H:%M:%SZ")))
    g.db.execute('insert into users (server_id, user_id, user_name, user_email) values (?,?,?,?)',
                 (server_id, user, name, email))
    g.db.commit()


def get_auth_status(auth_token):
    current_time = dt.datetime.today()
    expiry_date = g.db.execute('SELECT date_expired FROM access WHERE auth_token=?',(auth_token,)).fetchone()
    if not expiry_date:
        return 'not found'

    expiry_date = dt.datetime.strptime(expiry_date[0], "%Y-%m-%dT%H:%M:%SZ")
    if current_time > expiry_date:
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
    return make_response(jsonify({'message': 'Success: File upload compeleted successfully'}), 200)


def remove_from_uploads(tempdir):
    try:
        all_chunks = os.listdir(tempdir)
        for chunk in all_chunks:
            os.remove(os.path.join(tempdir, chunk))
        os.rmdir(tempdir)
    except OSError:
        pass


def get_file_data(identifier, data_column):
    # Check if identifier is in the db first
    if g.db.execute('select exists(select 1 from files where identifier=? LIMIT 1)', (identifier,)).fetchone()[0]:
        return g.db.execute('select {} from files where identifier=?'.format(data_column), (identifier,)).fetchone()[0]
    return False


def get_files_by_status(user_id, status):
    metadata_columns = ['identifier', 'sample_name', 'filename', 'file_type', 'readset', 'platform', 'run_type',
                        'capture_kit', 'library', 'reference']
    db_files = g.db.execute('SELECT {} FROM files WHERE upload_status=? and user_id=?'
                            .format(', '.join(metadata_columns)), (status, user_id)).fetchall()

    if len(db_files) > 0:
        files = {}
        for file_metadata in db_files:
            identifier = file_metadata[0]
            files[identifier] = {
                'identifier': file_metadata[0],
                'sample-name': file_metadata[1],
                'filename': file_metadata[2],
                'type': file_metadata[3],
                'readset': file_metadata[4],
                'platform': file_metadata[5],
                'runType': file_metadata[6],
                'captureKit': file_metadata[7],
                'library': file_metadata[8],
                'reference': file_metadata[9]
            }
        return files
    return dict(db_files)


def get_user_by_auth_token(auth_token):
    if g.db.execute('select exists(select 1 from access where auth_token=? LIMIT 1)', (auth_token,)).fetchone()[0]:
        return g.db.execute('select user_id from access where auth_token=?', (auth_token,)).fetchone()[0]


def insert_file_metadata(form_dict):
    # Values that need to be inserted/updated in the db
    update_keys = ['auth_token', 'identifier', 'sample_name', 'filename', 'total_size', 'file_type', 'readset',
                   'platform', 'run_type', 'capture_kit', 'library', 'reference']
    update_dict = {
        'server_id': g.db.execute('select server_id from access where auth_token=?',
                                  (form_dict['auth_token'],)).fetchone()[0],
        'user_id': get_user_by_auth_token(form_dict['auth_token']),
        'date_upload_start': dt.datetime.today().strftime("%Y-%m-%dT%H:%M:%SZ"),
        'upload_status': 'ongoing'
    }

    for key in update_keys:
        update_dict[key] = form_dict[key]

    keys = sorted(update_dict)
    values = [update_dict[key] for key in keys]

    # If the identifier exists, update the metadata
    SQL = 'INSERT OR REPLACE INTO files ({}) VALUES ({})'.format(', '.join(keys), ','.join('?' * len(keys)))
    g.db.execute(SQL, values)
    g.db.commit()


def update_file_metadata(form_dict):
    # Values that need to be updated in the db
    update_keys = ['file_type', 'readset', 'platform', 'run_type', 'capture_kit', 'library',
                   'reference', 'identifier']
    update_dict = {'sample_name': form_dict['new_sample_name']}
    for key in update_keys:
        update_dict[key] = form_dict[key]

    g.db.execute('update files set {} where identifier=?'
                 .format(', '.join('{0}="{1}"'.format(item[0], item[1]) for item in update_dict.items())),
                 (form_dict['identifier'],))
    g.db.commit()


def update_file_status(identifier, status):
    # Update the end timestamp for cancelled, complete, or corrupt statuses
    if status != 'ongoing':
        current_date = dt.datetime.today().strftime("%Y-%m-%dT%H:%M:%SZ")
        g.db.execute('update files set date_upload_end=? where identifier=?', (current_date, identifier))

    g.db.execute('update files set upload_status=? where identifier=?', (status, identifier))
    g.db.commit()
