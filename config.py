import os

DATABASE = os.path.join(os.getcwd(),'DCC.db')
SCHEMA = os.path.join(os.getcwd(),'schema.sql')
DEBUG = True
SECRET_KEY = 'development key'
USERNAME = 'admin'
PASSWORD = 'default'
AUTH_TOKEN = 'test'
UPLOAD_FOLDER = os.path.join(os.getcwd(),'uploads')
