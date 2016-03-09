#!/usr/bin/python

import sqlite3
import os
from server import views
from config import DATABASE


def setup():
    if not os.path.isfile(DATABASE):
        views.init_db()

    db = views.connect_db()
    db.execute("PRAGMA foreign_keys=ON")
    db.commit()

    return db


def query(db):
    while True:
        SQL = raw_input('SQL> ')
        if SQL.lower() == 'close':
            db.commit()
            db.close()
            break
        else:
            try:
                if SQL.lower().startswith('select'):
                    cursor = db.execute(SQL)
                    tabular([description[0] for description in cursor.description], cursor.fetchall())
                else:
                    db.execute(SQL)

            except sqlite3.Error as e:
                print "An error occurred: ", e.args[0]


def tabular(headers, table):
    widths = map(len, headers)
    for row in table:
        widths = map(max, zip(widths, map(lambda x: len(str(x)), row)))
    print ""
    i = 0
    for column_header in headers:
        if i == 0:
            print '|',
        print '{message: <{fill}}'.format(message=column_header.upper(), fill=widths[i]),'|',
        i += 1
    print""
    print "-"*(sum(widths)+len(widths)*3+1)
    for row in table:
        i = 0
        for data in row:
            if i == 0:
                print '|',
            print '{message: <{fill}}'.format(message=data, fill=widths[i]), '|',
            i += 1
        print ""
    print ""


query(setup())
