import os

DEBUG = True
HOST = '0.0.0.0'
PORT = 8000

SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(os.getcwd(), 'DCC.db')
SQLALCHEMY_COMMIT_ON_TEARDOWN = True
SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_MIGRATE_REPO = os.path.join(os.getcwd(), 'db_repository')

SCHEMA = os.path.join(os.getcwd(), 'schema.sql')
SECRET_KEY = 'development key'
SERVER_TOKENS = {'server-token':
                     {'name': 'server_name',
                      'id': 'server_id'
                      }
                 }
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
LOGFILE = os.path.join(os.getcwd(), 'dcc.log')
APPLICATION_ROOT = None
