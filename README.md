# Large file transfer for the DCC


## Quickstart

### Start up the server
Start up the server in one console:
```
$ python run.py
```

### Upload a file:
Create a random gzipped file:
```
$ cat /dev/random | head -c 10000000 | gzip > test.gz
```

Open a browser to `localhost:5000` and drop a file in the drop aread to upload the file in chunks of 1MB:


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
