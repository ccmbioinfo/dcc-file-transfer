import os

from . import BaseConfig


class Config(BaseConfig):
    DEBUG = True

    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(os.getcwd(), 'DCC.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
    LOGFILE = os.path.join(os.getcwd(), 'dcc.log')
