import sqlite3

from contextlib import closing

from server import app


def connect_db():
    # connection to the database path
    conn = sqlite3.connect(app.config['DATABASE'],
                           detect_types=sqlite3.PARSE_DECLTYPES)
    # necessary to get working on production server
    conn.text_factory = str
    # foreign key constraints need to be turned on with each connection
    conn.execute("PRAGMA foreign_keys=ON")
    conn.commit()
    return conn


def init():
    # initalize the database if it doesn't already exist.
    # this step needs to be run manually form the command line
    # from server import database; database.init()
    with closing(connect_db()) as db:
        with open(app.config['SCHEMA'], mode='r') as f:
            db.cursor().executescript(f.read())
        db.commit()
