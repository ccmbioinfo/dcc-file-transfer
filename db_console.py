#!/usr/bin/python

import sqlite3
import os
from server import views
from config import DATABASE


def query(db):
    while True:
        SQL = raw_input('SQL> ')
        if SQL.lower() == 'close':
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


def setup():
    if not os.path.isfile(DATABASE):
        views.init_db()
        db = views.connect_db()
        db.execute("insert into USERS (USERNAME, LOGIN_SITE, AUTH_TOKEN)"
                   "values ('DORIN', 'phenomecentral.com', '2msu48xs35')")
        db.execute("PRAGMA foreign_keys=ON")
        db.commit()

    else:

        db = views.connect_db()
        db.execute("PRAGMA foreign_keys=ON")
        db.commit()

    return db


'''
db.execute("insert into USERS (USERNAME, LOGIN_SITE, AUTH_TOKEN) "
           "values ('BOB', 'phenomecentral.com', '98jkewo9dhn')")

db.execute("insert into USERS (USERNAME, LOGIN_SITE, AUTH_TOKEN) "
           "values ('JOE', 'SomeOtherSite.com', '5iou43aa85')")

db.execute("insert into USERS (USERNAME, LOGIN_SITE, AUTH_TOKEN) "
           "values ('TOM', 'dipg.com', '09dfdf09wrw')")

db.commit()

print db.execute('select * from USERS').fetchall()


db.execute("insert into GROUPS (GROUPNAME, LOGIN_SITE) "
           "values ('ADMIN', 'admin.com')")

db.execute("insert into GROUPS (GROUPNAME, LOGIN_SITE) "
           "values ('CCMBIO', 'phenomecentral.com')")

db.execute("insert into GROUPS (GROUPNAME, LOGIN_SITE) "
           "values ('DIPG', 'dipg.com')")

db.commit()




try:
    db.execute("insert into MEMBERSHIP (USER_ID, GROUP_ID) values (10,12)")
    db.commit()
except sqlite3.IntegrityError:
    print "caught the FK constraint violation!"

print 'USERS: ', db.execute("select * from USERS").fetchall()
print 'GROUPS: ', db.execute("select * from GROUPS").fetchall()
print 'MEMBERSHIP: ', db.execute("selecthh * from MEMBERSHIP").fetchall()

db.close()

'''


query(setup())
