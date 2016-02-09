#!/usr/bin/python

import argparse
import os
import hashlib
import uuid
import datetime as dt
from re import match
from subprocess import Popen, PIPE


def checksum_md5(filename):
    md5 = hashlib.md5()
    with open(filename,'rb') as f:
        for chunk in iter(lambda: f.read(128*md5.block_size), b''):
            md5.update(chunk)
    return md5.hexdigest()


def valid_header(s):
    if s.count(':') != 1 or len(s.split(':')[0].strip()) == 0:
        error_msg = "Incorrect header format, must be of form 'key: value'"
        raise argparse.ArgumentTypeError(error_msg)
    return s


def valid_byte_count(s):
    if match('\d+$|\d+[k,m]$', s):
        if s.endswith('k'):
            return str(int(s[:-1]) * 1024)
        elif s.endswith('m'):
            return str(int(s[:-1]) * 1048576)
        else:
            return s
    else:
        error_msg = "Incorrect byte size"
        raise argparse.ArgumentTypeError(error_msg)


def valid_file(file_name):
    f = os.path.abspath(file_name)
    if os.path.isfile(f):
        return f
    else:
        error_msg = "Cannot locate file: %s" % f
        raise argparse.ArgumentTypeError(error_msg)


parser = argparse.ArgumentParser('Upload a file (in chunks) using curl.', usage='%(prog)s [-h] [-i INI]')

parser.add_argument('file', help='the file to be uploaded', type=valid_file)
parser.add_argument('-H', '--header', help='header metadata', default=[], type=valid_header, nargs='*', metavar='')
parser.add_argument('-b', '--bytes', help='size of each split in bytes', default=None, type=valid_byte_count,
                    metavar='')
parser.add_argument('-a', '--address', help='host address', default='http://localhost:5000/upload', metavar='')
parser.add_argument('-m', '--method', help='HTTP method', choices=['POST', 'PUT'], default='POST')
parser.add_argument('-v', '--verbose', help='include output verbosity', action='store_true')

args = parser.parse_args()  # can refer to each arg through arg.name i.e. arg.file

print("Sending %s to %s Date: " % (args.file[args.file.rindex("/") + 1:], args.address) +
      dt.datetime.now().strftime("%d-%M-%Y %Hh:%Mm:%Ss"))

STD_OUT = None #None or PIPE

total_size = os.path.getsize(args.file)
identifier = str(uuid.uuid4())

filename = args.file[args.file.rindex("/") + 1:]


if args.bytes and int(args.bytes) < total_size:
    tmp_dir = os.path.join(os.getcwd(), filename[:filename.index(".")])
    Popen(['mkdir', tmp_dir]).wait()

    if args.verbose: print("Made temp directory: %s" % tmp_dir)

    prefix = os.path.join(tmp_dir, filename) + "."
    Popen(['split', '-b', args.bytes, args.file, prefix]).wait()

    slices = os.listdir(tmp_dir)
    slices.sort()

    num_chunks = len(slices)
    current_chunk = 1

    if args.verbose: print("Split file: %s into %d chunks" % (filename, num_chunks))

    for chunk in slices:
        chunk_size = os.path.getsize(os.path.join(tmp_dir, chunk))

        resumable_form = ['-F', 'resumableChunkNumber=%d' % current_chunk,
                          '-F', 'resumableTotalChunks=%d' % num_chunks,
                          '-F', 'resumableTotalSize=%d' % total_size,
                          '-F', 'resumableChunkSize=%d' % chunk_size,
                          '-F', 'resumableIdentifier=%s' % identifier,
                          '-F', 'resumableFilename=%s' % filename]

        cmd_list = ['curl', '-i', '-X', args.method] + \
                   resumable_form + \
                   ['-F', 'file=@' + os.path.join(tmp_dir, chunk), args.address]
        Popen(cmd_list,stdout=STD_OUT).wait()

        if args.verbose: print("Sent chunk %d of %d" % (current_chunk, num_chunks))
        current_chunk += 1

    Popen(['rm', '-rf', tmp_dir]).wait()
    if args.verbose: print("Removed temp directory: %s" % tmp_dir)

else:
    # Remember that Popen with listed arguments cannot handle white space in any item listed!!
    resumable_form = [  '-F', 'resumableChunkNumber=1',
                        '-F', 'resumableTotalChunks=1',
                        '-F', 'resumableTotalSize=%d' % total_size,
                        '-F', 'resumableChunkSize=%d' % total_size,
                        '-F', 'resumableIdentifier=%s' % identifier,
                        '-F', 'resumableFilename=%s' % filename]

    cmd_list = ['curl', '-i', '-X', args.method] + resumable_form + ['-F', 'file=@' + args.file, args.address]
    Popen(cmd_list, stdout=STD_OUT).wait()

