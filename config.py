import os

DATABASE = os.path.join(os.getcwd(),'DCC.db')
SCHEMA = os.path.join(os.getcwd(),'schema.sql')
DEBUG = True
SECRET_KEY = 'development key'
USERNAME = 'admin'
PASSWORD = 'default'
ACCESS_CODES = ['']
UPLOAD_FOLDER = os.path.join(os.getcwd(),'uploads')
