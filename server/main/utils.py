import gzip
import hashlib
import os
import base64
import datetime as dt

from glob import glob

from flask import jsonify, make_response
from sqlalchemy.exc import IntegrityError

from server import app, db
from server.models import Server, User, Access, Sample, File, Job, Run


CHUNK_PREFIX = 'chunk.'


class InvalidServerToken(Exception):
    pass


def generate_auth_token(server_token, username, name=None, email=None, duration_days=1):
    # Check for a valid server token in the database
    server = Server.query.filter_by(server_token=server_token).first()
    if not server:
        raise InvalidServerToken({"message": "Invalid server token"})

    # Get user from db or create a new one
    user_id = '{}/{}'.format(server.server_id, username)
    user = User.query.filter_by(user_id=user_id).first()
    if not user:
        user = User(user_id=user_id, user_name=name, user_email=email)
        db.session.add(user)
        # Attach the new user to the server
        server.users.append(user)

    auth_token = base64.urlsafe_b64encode(os.urandom(12))
    current_date = dt.datetime.today()
    expiry_date = current_date + dt.timedelta(duration_days)
    access = Access(auth_token=auth_token, creation_date=current_date, expiration_date=expiry_date)
    db.session.add(access)

    # Attach the new token to the user
    user.access.append(access)
    db.session.commit()

    return auth_token, expiry_date


def get_auth_status(auth_token):
    current_time = dt.datetime.today()
    access = Access.query.filter_by(auth_token=auth_token).first()
    if not access:
        return 'not found'
    if current_time > access.expiration_date:
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
    for file in files:
        db_files[file.identifier] = {
                'identifier': file.identifier,
                # Sample name passed is from the first sample it was originally uploaded with
                'sample-name': file.samples[0].sample_name,
                'filename': file.filename,
                'type': file.file_type,
                'readset': file.readset,
                'platform': file.platform,
                'run-type': file.run_type,
                'capture-kit': file.capture_kit,
                'library': file.library,
                'reference': file.reference
            }
    return db_files


def get_user_by_auth_token(auth_token):
    access = Access.query.filter_by(auth_token=auth_token).first()
    if access:
        return access.user


def get_or_create_sample(sample_name, user_id):
    sample = Sample.query.filter_by(user_id=user_id, sample_name=sample_name).first()

    if not sample:
        sample = Sample(sample_name=sample_name)
        user = User.query.filter_by(user_id=user_id).first()
        user.samples.append(sample)
        try:
            db.session.add(sample)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            # Sample was added already or in a separate thread, therefore rollback and return the existing sample
            return Sample.query.filter_by(user_id=user_id, sample_name=sample_name).first()

    return sample


def get_or_create_file(data):
    auth_token = data.get('auth_token')

    user = User.query.filter_by(user_id=get_user_by_auth_token(auth_token).user_id).first()
    sample = get_or_create_sample(data.get('sample_name'), user.user_id)
    access = Access.query.filter_by(auth_token=auth_token).first()
    file = File.query.filter_by(identifier=data.get('identifier')).first()
    if not file:
        file = File()

    file.identifier = data.get('identifier')
    file.filename = data.get('filename')
    file.total_size = data.get('total_size')
    file.file_type = data.get('file_type')
    file.user_id = user.user_id
    file.access_id = access.id
    file.readset = data.get('readset')
    file.platform = data.get('platform')
    file.run_type = data.get('run_type')
    file.capture_kit = data.get('capture_kit')
    file.library = data.get('library')
    file.reference = data.get('reference')
    file.upload_status = 'ongoing'
    file.upload_start_date = dt.datetime.today()
    file.location = 'forge'

    # Attach the file to this sample and access objects
    sample.files.append(file)
    access.files.append(file)

    db.session.add(file)
    db.session.commit()

    return file


def update_file_status(identifier, status):
    file = File.query.filter_by(identifier=identifier).first()
    if file:
        # set the file status
        file.upload_status = status
        # set the upload end date for any status other than 'ongoing'
        if status != 'ongoing':
            file.upload_end_date = dt.datetime.today()

        db.session.add(file)
        db.session.commit()


def generate_job(user_id, job_name):
    user = User.query.filter_by(user_id=user_id).first()
    if job_name not in [jobs.name for jobs in user.jobs]:
        job = Job(name=job_name, status='ready', pipeline='dnaseq')
        user.jobs.append(job)

        try:
            db.session.add(job)
            db.session.commit()
            return job
        except IntegrityError:
            db.session.rollback()


def generate_run(user_id, job_name, sample, readset, library, run_type, bam, fastq1, fastq2, bed):
    job = Job.query.filter_by(user_id=user_id, name=job_name).first()
    run = Run(sample_name=sample.sample_name,
              readset=readset,
              library=library,
              run_type=run_type,
              bed=get_file_path(bed),
              fastq1=get_file_path(fastq1),
              fastq2=get_file_path(fastq2),
              bam=get_file_path(bam))
    job.runs.append(run)
    try:
        db.session.add(run)
        db.session.commit()
        return run
    except IntegrityError:
        db.session.rollback()


def get_file_path(file):
    if file:
        return os.path.join(app.config['UPLOAD_FOLDER'], file.access.auth_token, file.identifier, file.filename)


def get_job(user_id, job_name):
    return Job.query.filter_by(user_id=user_id, name=job_name).first()


def get_sample(user_id, sample_name):
    return Sample.query.filter_by(user_id=user_id, sample_name=sample_name).first()


def get_file(user_id, file_id):
    return File.query.filter_by(user_id=user_id, identifier=file_id).first()


def update_job_status(job, status):
    try:
        job.status = status
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
