import unittest
import datetime as dt

from flask import json
from base import BaseTestCase, db
from server.models import Server, User, Access, File, Job, Run


class TestMain(BaseTestCase):

    def test_app_exists(self):
        self.assertFalse(self.app is None)

    def test_app_is_testing(self):
        self.assertTrue(self.app.config['TESTING'])

    def test_home(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)


class PopulatedTestCase(BaseTestCase):

    def setUp(self):
        db.create_all()
        self.server = Server(server_token="my-server-token",
                             server_id='my-server-id',
                             server_name='My Server Name')

        self.user = User(user_name='My name',
                         user_id='my-server-id/old-name',
                         user_email='dont@email.me')

        self.access = Access(user_id='my-server-id/old-name',
                             auth_token='LxI6PrSvaCGUg3t5',
                             creation_date=dt.datetime.today(),
                             expiration_date=dt.datetime.today() + dt.timedelta(7))

        self.file1 = File(identifier='LxI6PrSvaCGUg3t5_test_testraw_R1fastqgz_100030523',
                          filename='test_raw_R1.fastq.gz',
                          total_size='100030523',
                          file_type='FASTQ',
                          platform='Illumina',
                          run_type='Paired End',
                          capture_kit='Agilent',
                          library='myLib',
                          reference='hg19',
                          upload_status='complete',
                          upload_start_date=dt.datetime.today(),
                          upload_end_date=dt.datetime.today() + dt.timedelta(1),
                          user_id=self.user.user_id,
                          access_id=self.access.id,
                          location='forge')

        self.file2 = File(identifier='LxI6PrSvaCGUg3t5_test_testraw_R2fastqgz_100030523',
                          filename='test_raw_R2.fastq.gz',
                          total_size='100030523',
                          file_type='FASTQ',
                          platform='Illumina',
                          run_type='Paired End',
                          capture_kit='Agilent',
                          library='myLib',
                          reference='hg19',
                          upload_status='complete',
                          upload_start_date=dt.datetime.today(),
                          upload_end_date=dt.datetime.today() + dt.timedelta(1),
                          user_id=self.user.user_id,
                          access_id=self.access.id,
                          location='forge')

        self.job = Job(user_id=self.user.user_id,
                       name='test-job',
                       status='pending')

        self.run = Run(sample_name='test',
                       fastq1=self.file1.id,
                       fastq2=self.file2.id,
                       job_id=self.job.id,
                       readset='test',
                       run_type='Paired End')

        self.server.users.append(self.user)
        self.user.access.append(self.access)
        self.user.files.append(self.file1)
        self.user.files.append(self.file2)
        self.user.jobs.append(self.job)
        self.job.runs.append(self.run)

        db.session.add(self.server)
        db.session.commit()


class TestViewsTransfers(PopulatedTestCase):

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

        self.assertTrue('expiresAt' in response.json.keys())
        self.assertTrue('transferCode' in response.json.keys())
        self.assertTrue('user' in response.json.keys())
        self.assertEquals(response.json['user'], 'new-user')
        self.assertTrue(User.query.filter_by(user_id='my-server-id/new-user') is not None)
        self.assertEquals(User.query.filter_by(user_id='my-server-id/new-user').first().access[0].auth_token,
                          response.json['transferCode'])

    def test_create_auth_token_old_user(self):
        response = self.client.post("/transfers/",
                                    data=json.dumps(dict(user='old-name')),
                                    content_type='application/json',
                                    headers={'X-Server-Token': 'my-server-token'})

        self.assertTrue('expiresAt' in response.json.keys())
        self.assertTrue('transferCode' in response.json.keys())
        self.assertTrue('user' in response.json.keys())
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

        self.assertTrue('expiresAt' in response.json.keys())
        self.assertTrue('transferCode' in response.json.keys())
        self.assertTrue('user' in response.json.keys())
        self.assertEquals(response.json['user'], 'complete-user')


class TestViewsTransfersAuthToken(PopulatedTestCase):
    pass


class TestViewsSamples(PopulatedTestCase):
    pass


class TestViewsJobs(PopulatedTestCase):

    def test_create_job_wrong_transfer_code(self):
        response = self.client.post("/transfers/<auth_token>/users/<user_id>/jobs")
        self.assertEquals(response.json, dict(message='Error: Transfer code does not exist'))

    def test_create_job_wrong_user_id(self):
        response = self.client.post("/transfers/LxI6PrSvaCGUg3t5/users/<user_id>/jobs")
        self.assertEquals(response.json, dict(message='Error: Unauthorized'))

    def test_create_job_no_job_name(self):
        response = self.client.post("/transfers/LxI6PrSvaCGUg3t5/users/old-name/jobs")
        self.assertEquals(response.json, dict(message='Error: missing jobName'))

    def test_create_job(self):
        response = self.client.post("/transfers/LxI6PrSvaCGUg3t5/users/old-name/jobs",
                                    data=json.dumps(dict(jobName='test-job-1')),
                                    content_type='application/json')
        self.assertEquals(response.json, dict(message='Success: new job test-job-1 created'))
        user = User.query.filter_by(user_id='my-server-id/old-name').first()
        job = Job.query.filter_by(name='test-job-1').first()
        self.assertTrue(job is not None)
        self.assertTrue(job.status == 'pending')
        self.assertTrue(job.start_date is None and job.end_date is None)
        self.assertTrue(job in user.jobs)

    def test_create_job_same_name(self):
        response = self.client.post("/transfers/LxI6PrSvaCGUg3t5/users/old-name/jobs",
                                    data=json.dumps(dict(jobName='test-job')),
                                    content_type='application/json')
        self.assertEquals(response.json, dict(message='Error: Could not create job, '
                                                      'ensure name is unique'))

    def test_update_job_wrong_transfer_code(self):
        response = self.client.put("/transfers/<auth_token>/users/<user_id>/jobs/<job_name>")
        self.assertEquals(response.json, dict(message='Error: Transfer code does not exist'))

    def test_update_job_wrong_user_id(self):
        response = self.client.put("/transfers/LxI6PrSvaCGUg3t5/users/<user_id>/jobs/<job_name>")
        self.assertEquals(response.json, dict(message='Error: Unauthorized'))

    def test_update_job_wrong_job_name(self):
        response = self.client.put("/transfers/LxI6PrSvaCGUg3t5/users/old-name/jobs/wrong_name")
        self.assertEquals(response.json, dict(message='Error: Job wrong_name, does not exist'))

    def test_update_job(self):
        job = Job.query.filter_by(user_id='my-server-id/old-name', name='test-job').first()
        response = self.client.put("/transfers/LxI6PrSvaCGUg3t5/users/old-name/jobs/test-job",
                                   data=json.dumps(dict(status='submit')),
                                   content_type='application/json')
        self.assertEquals(response.json, dict(message='Success: job status was updated'))
        self.assertTrue(job.status == 'submit')
        response = self.client.put("/transfers/LxI6PrSvaCGUg3t5/users/old-name/jobs/test-job",
                                   data=json.dumps(dict(status='cancel')),
                                   content_type='application/json')
        self.assertEquals(response.json, dict(message='Success: job status was updated'))
        self.assertTrue(job.status == 'cancel')

    def test_update_job_already_running(self):
        Job.query.filter_by(user_id='my-server-id/old-name', name='test-job').first().status = 'running'
        response = self.client.put("/transfers/LxI6PrSvaCGUg3t5/users/old-name/jobs/test-job",
                                   data=json.dumps(dict(status='submit')),
                                   content_type='application/json')
        self.assertEquals(response.json, dict(message='Error: Status cannot be changed on a running or complete job'))

    def test_update_job_no_status(self):
        response = self.client.put("/transfers/LxI6PrSvaCGUg3t5/users/old-name/jobs/test-job")
        self.assertEquals(response.json, dict(message='Error: missing status'))

    def test_update_job_invalid_status(self):
        response = self.client.put("/transfers/LxI6PrSvaCGUg3t5/users/old-name/jobs/test-job",
                                   data=json.dumps(dict(status='invalid-status')),
                                   content_type='application/json')
        self.assertEquals(response.json, dict(message='Error: Invalid status given'))


class TestViewsRuns(PopulatedTestCase):
    pass


if __name__ == '__main__':
    unittest.main()
