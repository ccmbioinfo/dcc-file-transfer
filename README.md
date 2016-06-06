# Large file transfer for the DCC


## Quickstart

### Initialize the database
Initialize the database based on the last migrations:
```sh
python manage.py db upgrade
```

### Load the database with a new server and server-token
```sh
python manage.py authorize_server "my-server-token" "My Server Name" "my-server-id"
```

### Start up the DCC server
Start up the server in one console:
```sh
python manage.py runserver
```

### Generate a transfer code
Run the following curl command in the console using a valid server token (configurable in config.py) to obtain a transfer code valid for 24 hours
```sh
curl -H "X-Server-Token: my-server-token" -H "Content-Type: application/json" -X POST -d '{"user":"your-user-id","name":"your-user-name","email":"your-user-email","duration":7}' http://localhost:8000/transfers/
```

### Upload a file:
For example, create a random 10MB file:
```sh
cat /dev/random | head -c 10000000 > test.bin
```

Open a browser to `localhost:8000` , then log in using your transfer code.
Add a sample and drop your file to upload the file in chunks of 1MB:


## Setting up the environment

Create and active a new virtual environment:
```
$ virtualenv -p python2.7 .virtualenv
$ source .virtualenv/bin/active
```

Install the dependencies:
```
$ pip install -r requirements.txt
```


## Performing database migrations

After modifying the schema, create a new migration script:
```
$ python manage.py db migrate
```

Upgrade to the new version:
```
$ python manage.py db upgrade
```

Downgrade to the previous version:
```
$ python manage.py db downgrade
```

*Note: for OperationalErrors with SQLite when dropping or adding columns, please modify
the migration script to use the following workaround:
```python
with op.batch_alter_table("some_table") as batch_op:
    # Add a column
    batch_op.add_column(Column('foo', Integer))
    # Drop a column
    batch_op.drop_column('bar')
```
