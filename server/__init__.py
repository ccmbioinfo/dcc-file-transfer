from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy

app = Flask(__name__)

app.config.from_object('config.base')
db = SQLAlchemy(app)

# Must go last to avoid circular imports
from server import views, models
