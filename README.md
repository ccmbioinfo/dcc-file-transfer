# Large file transfer for the DCC


## Quickstart

### Load the database with a new server and server-token
```sh
python run.py authorize-server my-server-id "My Server Name" my-server-token
```

### Initialize the database migration manager
Initialize the database manager to handle upgrades and downgrades:
```sh
python manage.py db init
```

### Start up the DCC server
Start up the server in one console:
```sh
python run.py start
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
