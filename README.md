# Large file transfer for the DCC


## Quickstart

### Start up the server
Start up the server in one console:
```
$ python run.py
```

### Send a file with the client
Create a random gzipped file:
```
$ cat /dev/random | head -c 10000000 | gzip > test.gz
```

Upload the file in chunks of 1MB:
```
$ python curl_resumable_upload.py -b 1000000 test.gz
```


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
