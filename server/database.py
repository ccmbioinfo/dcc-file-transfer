import sqlite3

from contextlib import closing

from server import app


def connect_db():
    # connection to the database path
    return sqlite3.connect(app.config['DATABASE'])


def init():
    # initalize the database if it doesn't already exist.
    # this step needs to be run manually form the command line
    # from server import database; database.init()
    with closing(connect_db()) as db:
        with open(app.config['SCHEMA'], mode='r') as f:
            db.cursor().executescript(f.read())
        db.commit()
