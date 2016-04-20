# Large file transfer for the DCC


## Quickstart

### Initialize the database
Initialize the database according to the schema.sql:
```sh
python run.py initdb
```


### Start up the server
Start up the server in one console:
```sh
python run.py server
```

### Generate a transfer code
Run the following curl command in the console using a valid server token (configurable in config.py) to obtain a transfer code valid for 24 hours
```sh
curl -i -X POST -H "X-Server-Token: your-server-token" http://localhost:8000/transfers/
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
