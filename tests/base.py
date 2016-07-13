import logging

from flask.ext.testing import TestCase

from server import app, db


class BaseTestCase(TestCase):

    def create_app(self):
        app.config.from_object('config.TestingConfig')
        return app

    def setUp(self):
        db.create_all()

        # Don't show logging messages while testing
        logging.disable(logging.WARNING)

    def tearDown(self):
        logging.disable(logging.NOTSET)
        db.session.remove()
        db.drop_all()
