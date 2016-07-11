import unittest
import datetime as dt

from base import BaseTestCase, db
from server.models import Server, User, Access


class TestDatabase(BaseTestCase):
    def setUp(self):
        db.create_all()

        self.server = Server(server_token="my-server-token",
                             server_id='my-server-id',
                             server_name='My Server Name')
        self.user = User(user_name='My name',
                         user_id='name',
                         user_email='dont@email.me')
        self.access = Access(auth_token='CShw3okdl5hwrI4V',
                             creation_date=dt.datetime.today(),
                             expiration_date=dt.datetime.today() + dt.timedelta(7))

        self.server.users.append(self.user)
        self.user.access.append(self.access)

        db.session.add(self.server)
        db.session.commit()

    def test_add_server(self):
        self.assertTrue(Server.query.filter_by(server_id='my-server-id').first() is not None)

    def test_add_user(self):
        self.assertTrue( User.query.filter_by(user_id='name').first() is not None)

    def test_add_access(self):
        self.assertTrue(Access.query.filter_by(auth_token='CShw3okdl5hwrI4V').first() is not None)

    def test_dependencies(self):
        self.assertTrue(self.user in Server.query.filter_by(server_id='my-server-id').first().users)
        self.assertTrue(self.access in User.query.filter_by(user_id='name').first().access)


if __name__ == '__main__':
    unittest.main()
