#!/usr/bin/env python

import sys

from server import app, db


DEBUG = app.config['DEBUG']


def start_server(host, port):
    app.run(debug=DEBUG, host=host, port=port, threaded=True)


def authorize_server(id, name, token):
    # try to create object and add to db, except if db not created yet, let user know to run initdb first
    pass


def parse_args(args):
    from argparse import ArgumentParser

    parser = ArgumentParser()
    subparsers = parser.add_subparsers(title='subcommands')
    subparser = subparsers.add_parser('initdb',
                                      description="Initialize database")
    subparser.set_defaults(function=db.create_all)

    subparser = subparsers.add_parser('start', description="Start running the server")
    subparser.add_argument("-p", "--port", default=app.config['PORT'],
                           dest="port", type=int, metavar="PORT",
                           help="The port the server will listen on (default: %(default)s)")
    subparser.add_argument("--host", default=app.config['HOST'],
                           dest="host", metavar="IP",
                           help="The host the server will listen to (0.0.0.0 to listen globally; 127.0.0.1 to listen locally; default: %(default)s)")
    subparser.set_defaults(function=start_server)

    subparser = subparsers.add_parser('authorize-server', description="Authorize server to make requests")
    subparser.add_argument("id", metavar="SERVER_ID",
                           help="The port the server will listen on (default: %(default)s)")
    subparser.add_argument("name", metavar="SERVER_NAME",
                           help="The host the server will listen to (0.0.0.0 to listen globally; 127.0.0.1 to listen locally; default: %(default)s)")
    subparser.add_argument("token", metavar="SERVER_TOKEN",
                           help="The host the server will listen to (0.0.0.0 to listen globally; 127.0.0.1 to listen locally; default: %(default)s)")
    subparser.set_defaults(function=authorize_server)

    args = parser.parse_args(args)
    if not hasattr(args, 'function'):
        parser.error('a subcommand must be specified')
    return args


def main(args=sys.argv[1:]):
    args = parse_args(args)

    # Call the function for the corresponding subparser
    kwargs = vars(args)
    function = kwargs.pop('function')
    function(**kwargs)


if __name__ == '__main__':
    sys.exit(main())
