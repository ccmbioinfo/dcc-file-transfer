import os

DEBUG = True
HOST = '0.0.0.0'
PORT = 8000

DATABASE = os.path.join(os.getcwd(), 'DCC.db')
SCHEMA = os.path.join(os.getcwd(), 'schema.sql')
SECRET_KEY = 'development key'
ACCESS_CODES = ['your-access-code']
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
