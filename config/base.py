import os

HOST = '0.0.0.0'
PORT = 8000

SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(os.getcwd(), 'DCC.db')
SQLALCHEMY_COMMIT_ON_TEARDOWN = True
SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_MIGRATE_REPO = os.path.join(os.getcwd(), 'db_repository')

SECRET_KEY = 'development key'
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
APPLICATION_ROOT = None
