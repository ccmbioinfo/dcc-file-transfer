#!/usr/bin/env python

import os

from flask_script import Manager
from flask_migrate import Migrate, MigrateCommand
from sqlalchemy.exc import IntegrityError

from server import app, db
from server.models import Server


migrate = Migrate(app, db)
manager = Manager(app)

# Set up Flask-Migrate db management
manager.add_command('db', MigrateCommand)


@manager.option(dest='token', metavar="SERVER_TOKEN", help="The server token required for creating users and their auth_tokens")
@manager.option(dest='name', metavar="SERVER_NAME", help="The server's name")
@manager.option(dest='id', metavar="SERVER_ID", help="The server identifier")
def authorize_server(id, name, token):
    """Authorize a server to connect to the API"""
    server = Server(server_id=id, server_name=name, server_token=token)
    try:
        db.session.add(server)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        app.logger.error('Server authentication token already in use')


@manager.command
def test():
    import unittest
    tests = unittest.TestLoader().discover('tests')
    unittest.TextTestRunner(verbosity=2).run(tests)


if __name__ == '__main__':
    manager.run()
