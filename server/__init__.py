import os

from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
from config import config

app = Flask(__name__)
app_settings = os.getenv('APP_SETTINGS', 'config.DevelopmentConfig')
app.config.from_object(app_settings)

db = SQLAlchemy(app)

# Must go last to avoid circular imports
from server import models
from server import views
