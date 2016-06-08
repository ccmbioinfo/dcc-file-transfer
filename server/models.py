from server import db


class File(db.Model):
    __tablename__ = 'files'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    identifier = db.Column(db.String, unique=True)
    filename = db.Column(db.String)
    total_size = db.Column(db.Integer)
    file_type = db.Column(db.String)
    readset = db.Column(db.String)
    platform = db.Column(db.String)
    run_type = db.Column(db.String)
    capture_kit = db.Column(db.String)
    library = db.Column(db.String)
    reference = db.Column(db.String)
    upload_status = db.Column(db.String)
    upload_start_date = db.Column(db.DateTime)
    upload_end_date = db.Column(db.DateTime)
    location = db.Column(db.String)

    # Outside References
    user_id = db.Column(db.String, db.ForeignKey('users.user_id'))
    access_id = db.Column(db.Integer, db.ForeignKey("access.id"))


class Access(db.Model):
    __tablename__ = 'access'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    auth_token = db.Column(db.String, unique=True)
    creation_date = db.Column(db.DateTime)
    expiration_date = db.Column(db.DateTime)

    # Inner References
    files = db.relationship(File, backref="access")

    # Outside References
    user_id = db.Column(db.String, db.ForeignKey('users.user_id'))


class Run(db.Model):
    __tablename__ = 'runs'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    sample_name = db.Column(db.String, db.ForeignKey('samples.sample_name'))
    readset = db.Column(db.String)
    library = db.Column(db.String)
    run_type = db.Column(db.String)
    bed = db.Column(db.Integer, db.ForeignKey('files.id'))
    fastq1 = db.Column(db.Integer, db.ForeignKey('files.id'))
    fastq2 = db.Column(db.Integer, db.ForeignKey('files.id'))
    bam = db.Column(db.Integer, db.ForeignKey('files.id'))

    # Outside References
    job_id = db.Column(db.String, db.ForeignKey('jobs.id'))


class Job(db.Model):
    __tablename__ = 'jobs'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String)
    status = db.Column(db.String)
    pipeline = db.Column(db.String)
    start_date = db.Column(db.DateTime)
    end_date = db.Column(db.DateTime)

    # Inner References
    runs = db.relationship(Run, backref="job")

    # Outside References
    user_id = db.Column(db.String, db.ForeignKey('users.user_id'))


sample_file_link = db.Table('sample_file_link',
                            db.Column('sample_id', db.Integer, db.ForeignKey('samples.id')),
                            db.Column('file_id', db.Integer, db.ForeignKey('files.id')))


class Sample(db.Model):
    __tablename__ = 'samples'
    __table_args__ = (db.UniqueConstraint('sample_name', 'user_id', name='sample_id'),)
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    sample_name = db.Column(db.String)

    # Inner References
    files = db.relationship(File, secondary=sample_file_link, backref="samples")

    # Outside References
    user_id = db.Column(db.String, db.ForeignKey('users.user_id'))


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.String, unique=True)
    user_name = db.Column(db.String)
    user_email = db.Column(db.String)

    # Inner References
    access = db.relationship(Access, backref="user")
    samples = db.relationship(Sample, backref="user")
    files = db.relationship(File, backref="user")
    jobs = db.relationship(Job, backref="user")

    # Outside References
    server_id = db.Column(db.String, db.ForeignKey('servers.server_id'))


class Server(db.Model):
    __tablename__ = 'servers'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    server_token = db.Column(db.String, unique=True)
    server_id = db.Column(db.String)
    server_name = db.Column(db.String)

    # Inner References
    users = db.relationship(User, backref='server')
