import gzip
import hashlib
import os
import datetime

from flask import g

from server import app


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


def bam_test(data):
    bam_eof = \
        '\x1f\x8b\x08\x04\x00\x00\x00\x00\x00\xff\x06\x00BC\x02\x00\x1b\x00\x03\x00\x00\x00\x00\x00\x00\x00\x00\x00'
    with open(data, 'rb') as f:
        f.seek(-28, 2)
        return f.read() == bam_eof


def check_status(identifier):
    # Check if identifier is in the db
    if g.db.execute('select exists(select 1 from files where identifier=? LIMIT 1)', (identifier,)).fetchone()[0]:
        return g.db.execute('select upload_status from files where identifier=?',
                            (identifier,)).fetchone()[0]
    return False


def get_tempdir(*args):
    path = app.config['UPLOAD_FOLDER']
    for subdir in list(args):
        path = os.path.join(path, subdir)
    return path


def get_chunk_filename(temp_dir, filename, chunk_number):
    return os.path.join(temp_dir, "{}.part{:08d}".format(filename, chunk_number))


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


def merge_chunks(in_paths, out_filename):
    in_paths.sort()
    out_dir = os.path.dirname(os.path.realpath(in_paths[0]))
    out_filepath = os.path.join(out_dir, out_filename)
    try:
        with open(out_filepath, 'wb') as OUTPUT:
            for chunk_path in in_paths:
                with open(chunk_path, 'rb') as INPUT:
                    OUTPUT.write(INPUT.read())
        app.logger.info('Merged %s files -> %s', len(in_paths), out_filepath)
        # Indicate that file merged successfully
        return True
    except IOError:
        # TODO: handle other types of potential errors here?
        os.remove(out_filepath)
        return False


def update_files_table(form_dict):
    # Values that need to be inserted/updated in the db
    update_keys = ['auth_token', 'identifier', 'sample_name', 'filename', 'total_size', 'file_type',
                   'readset', 'platform', 'run_type', 'capture_kit', 'library', 'reference']
    update_dict = {
        'site_access_code': g.db.execute('select site_access_code from access where auth_token=?',
                                        (form_dict['auth_token'],)).fetchone()[0],
        'date_upload_start': datetime.datetime.today().strftime("%Y-%m-%dT%H:%M:%SZ"),
        'upload_status': 'ongoing'
    }

    for key in update_keys:
        update_dict[key] = form_dict[key]

    keys = sorted(update_dict)
    values = [update_dict[key] for key in keys]

    # If the identifier exists, update the metadata
    if g.db.execute('select exists(select 1 from files where identifier=? LIMIT 1)',
                    (update_dict['identifier'],)).fetchone()[0]:
        SQL = 'UPDATE files SET {} WHERE identifier=?'.format(', '.join([key+'=?' for key in keys]))
        values.append(update_dict['identifier'])
    else:
        SQL = 'INSERT INTO files ({}) VALUES ({})'.format(', '.join(keys), ','.join('?' * len(keys)))
    app.logger.debug(SQL)
    app.logger.debug(values)

    g.db.execute(SQL, values)
    g.db.commit()


def valid_auth_token(auth_token):
    current_time = datetime.datetime.today()
    expiry_date = g.db.execute('SELECT date_expired FROM access WHERE auth_token=?',(auth_token,)).fetchone()
    if expiry_date:
        expiry_date = datetime.datetime.strptime(expiry_date[0], "%Y-%m-%dT%H:%M:%SZ")
        if current_time <= expiry_date:
            return True
    return False


def remove_from_uploads(tempdir):
    try:
        all_chunks = os.listdir(tempdir)
        for chunk in all_chunks:
            os.remove(os.path.join(tempdir, chunk))
        os.rmdir(tempdir)
    except OSError:
        pass

