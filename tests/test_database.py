import unittest
import datetime as dt

from base import BaseTestCase, db
from server.models import Server, User, Access


class TestDatabase(BaseTestCase):

    def test_add_server(self):
        server = Server(server_token="my-server-token",
                        server_id='my-server-id',
                        server_name='My Server Name')

        db.session.add(server)

        assert server in db.session

    def test_add_user(self):
        self.test_add_server()

        user = User(user_name='My name',
                    user_id='name',
                    user_email='dont@email.me')

        server = Server.query.filter_by().first()
        server.users.append(user)
        db.session.commit()

        assert user in db.session
        assert user in Server.query.filter_by().first().users

    def test_add_access(self):
        self.test_add_user()

        access = Access(auth_token='CShw3okdl5hwrI4V',
                        creation_date=dt.datetime.today(),
                        expiration_date=dt.datetime.today()+dt.timedelta(7))

        user = User.query.filter_by().first()
        user.access.append(access)

        db.session.commit()

        assert access in db.session
        assert access in User.query.filter_by().first().access


if __name__ == '__main__':
    unittest.main()
