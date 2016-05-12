#!/usr/bin/env python

import sys

from sqlalchemy.exc import IntegrityError

from server import app, db
from server.models import Server


DEBUG = app.config['DEBUG']


def start_server(host, port):
    app.run(debug=DEBUG, host=host, port=port, threaded=True)


def authorize_server(id, name, token):
    server = Server(server_id=id, server_name=name, server_token=token)
    try:
        db.session.add(server)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        app.logger.error('Server authentication token already in use')


def parse_args(args):
    from argparse import ArgumentParser

    parser = ArgumentParser()
    subparsers = parser.add_subparsers(title='subcommands')

    # Start running the server
    subparser = subparsers.add_parser('start', description="Start running the server")
    subparser.add_argument("-p", "--port", default=app.config['PORT'],
                           dest="port", type=int, metavar="PORT",
                           help="The port the server will listen on (default: %(default)s)")
    subparser.add_argument("--host", default=app.config['HOST'],
                           dest="host", metavar="IP",
                           help="The host the server will listen to (0.0.0.0 to listen globally; 127.0.0.1 to listen locally; default: %(default)s)")
    subparser.set_defaults(function=start_server)

    # Load db with a new server (name, id, server_token)
    subparser = subparsers.add_parser('authorize-server', description="Authorize server to make requests")
    subparser.add_argument("id", metavar="SERVER_ID",
                           help="The server identifier")
    subparser.add_argument("name", metavar="SERVER_NAME",
                           help="The server's name")
    subparser.add_argument("token", metavar="SERVER_TOKEN",
                           help="The server token required for creating users and their auth_tokens")
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
