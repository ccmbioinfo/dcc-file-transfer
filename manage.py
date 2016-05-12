#!/usr/bin/env python

import sys

from flask.ext.script import Manager
from flask.ext.migrate import Migrate, MigrateCommand
from sqlalchemy.exc import IntegrityError

from server import app, db
from server.models import Server


manager = Manager(app)

# Set up Flask-Migrate db management
migrate = Migrate(app, db)
manager.add_command('db', MigrateCommand)


@manager.option(dest='id', metavar="SERVER_ID", help="The server identifier")
@manager.option(dest='name', metavar="SERVER_NAME", help="The server's name")
@manager.option(dest='token', metavar="SERVER_TOKEN", help="The server token required for creating users and their auth_tokens")
def authorize_server(id, name, token):
    """Authorize a server to connect to the API"""
    server = Server(server_id=id, server_name=name, server_token=token)
    try:
        db.session.add(server)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        app.logger.error('Server authentication token already in use')


if __name__ == '__main__':
    manager.run()