import gzip
import hashlib
import os

from server import app


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


def merge_chunks(in_paths, out_filename):
    in_paths.sort()
    out_dir = os.path.dirname(os.path.realpath(in_paths[0]))
    out_filepath = os.path.join(out_dir, out_filename)
    with open(out_filepath, 'wb') as OUTPUT:
        for chunk_path in in_paths:
            with open(chunk_path, 'r') as INPUT:
                OUTPUT.write(INPUT.read())

    app.logger.debug('Merged %s files -> %s', len(in_paths), out_filepath)

    for chunk_path in in_paths:
        if os.path.isfile(chunk_path): os.remove(chunk_path)
