from server import db


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    server_id = db.Column(db.String)
    server_name = db.Column(db.String)
    user_id = db.Column(db.String)
    user_name = db.Column(db.String)
    user_email = db.Column(db.String)


class Access(db.Model):
    __tablename__ = 'access'
    access_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    server_id = db.Column(db.String)
    server_name = db.Column(db.String)
    user_id = db.Column(db.String)
    auth_token = db.Column(db.String(12), unique=True)
    date_created = db.Column(db.DateTime)
    date_expired = db.Column(db.DateTime)


class File(db.Model):
    __tablename__ = 'files'
    file_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    server_id = db.Column(db.String)
    user_id = db.Column(db.String)
    auth_token = db.Column(db.String(12))
    identifier = db.Column(db.String, unique=True)
    sample_name = db.Column(db.String)
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
    date_upload_start = db.Column(db.DateTime)
    date_upload_end = db.Column(db.DateTime)


class Run(db.Model):
    __tablename__ = 'runs'
    run_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.String)
    sample_name = db.Column(db.String)
    readset = db.Column(db.String)
    library = db.Column(db.String)
    run_type = db.Column(db.String)
    bed = db.Column(db.String)
    fastq1 = db.Column(db.String)
    fastq2 = db.Column(db.String)
    bam = db.Column(db.String)
    status = db.Column(db.String)
