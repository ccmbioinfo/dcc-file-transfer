import unittest

from flask import json
from base import BaseTestCase, db
from server.models import Server, User, Access


class TestMain(BaseTestCase):

    def test_app_exists(self):
        self.assertFalse(self.app is None)

    def test_app_is_testing(self):
        self.assertTrue(self.app.config['TESTING'])

    def test_home(self):
        response = self.client.get('/')
        self.assertEquals(response.status_code, 200)


class TestViewsTransfers(BaseTestCase):

    def setUp(self):
        BaseTestCase.setUp(self)
        self.server = Server(server_token="my-server-token",
                             server_id='my-server-id',
                             server_name='My Server Name')

        self.user = User(user_name='My name',
                         user_id='my-server-id/old-name',
                         user_email='dont@email.me')

        self.server.users.append(self.user)
        db.session.add(self.server)
        db.session.commit()

    def test_create_auth_token_no_user(self):
        response = self.client.post("/transfers/")
        self.assertEquals(response.json, dict(message='Error: missing user'))

    def test_create_auth_token_no_server_token(self):
        response = self.client.post("/transfers/",
                                    data=json.dumps(dict(user='username')),
                                    content_type='application/json')
        self.assertEquals(response.json, dict(message='Error: missing parameter'))

    def test_create_auth_token_invalid_user(self):
        response = self.client.post("/transfers/",
                                    data=json.dumps(dict(user='user/name')),
                                    content_type='application/json',
                                    headers={'X-Server-Token': 'some-token'})
        self.assertEquals(response.json, dict(message='Error: invalid username, must not contain "/"'))

    def test_create_auth_token_invalid_server_token(self):
        response = self.client.post("/transfers/",
                                    data=json.dumps(dict(user='username')),
                                    content_type='application/json',
                                    headers={'X-Server-Token': 'some-wrong-token'})
        self.assertEquals(response.json, dict(message='Error: Unauthorized'))

    def test_create_auth_token_new_user(self):
        response = self.client.post("/transfers/",
                                    data=json.dumps(dict(user='new-user')),
                                    content_type='application/json',
                                    headers={'X-Server-Token': 'my-server-token'})
        self.assertEquals(response.status_code, 200)
        self.assertTrue('expiresAt' in response.json)
        self.assertTrue('transferCode' in response.json)
        self.assertTrue('user' in response.json)
        self.assertEquals(response.json['user'], 'new-user')
        self.assertTrue(User.query.filter_by(user_id='my-server-id/new-user') is not None)
        self.assertEquals(User.query.filter_by(user_id='my-server-id/new-user').first().access[0].auth_token,
                          response.json['transferCode'])

    def test_create_auth_token_old_user(self):
        response = self.client.post("/transfers/",
                                    data=json.dumps(dict(user='old-name')),
                                    content_type='application/json',
                                    headers={'X-Server-Token': 'my-server-token'})
        self.assertEquals(response.status_code, 200)
        self.assertTrue('expiresAt' in response.json)
        self.assertTrue('transferCode' in response.json)
        self.assertTrue('user' in response.json)
        self.assertEquals(response.json['user'], 'old-name')
        self.assertEquals(len(User.query.filter_by(user_id='my-server-id/old-name').all()), 1)
        self.assertEquals(Access.query.filter_by(auth_token=response.json['transferCode']).first().user_id,
                          'my-server-id/old-name')

    def test_create_auth_token_complete_user(self):
        response = self.client.post("/transfers/",
                                    data=json.dumps(dict(user='complete-user',
                                                         name='Complete Name',
                                                         email='dont@email.me',
                                                         duration=99)),
                                    content_type='application/json',
                                    headers={'X-Server-Token': 'my-server-token'})
        self.assertEquals(response.status_code, 200)
        self.assertTrue('expiresAt' in response.json)
        self.assertTrue('transferCode' in response.json)
        self.assertTrue('user' in response.json)
        self.assertEquals(response.json['user'], 'complete-user')


class TestViewsTransfersAuthToken(BaseTestCase):
    pass


class TestViewsSamples(BaseTestCase):
    pass



if __name__ == '__main__':
    unittest.main()
