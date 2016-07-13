import os

from . import BaseConfig


class Config(BaseConfig):
    TESTING = True

    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(os.getcwd(), 'tests/DCC-test.db')
    UPLOAD_FOLDER = os.path.join(os.getcwd(), 'test-uploads')
    LOGFILE = os.path.join(os.getcwd(), 'dcc-test.log')
