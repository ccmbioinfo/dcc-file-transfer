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


## API

### Authentication


Authentication flow:

* Server configured to associate a secret key with a particular endpoint
* The endpoint requests a fixed-duration authentication token for a particular user, including the secret key in the request
* The user can then login with the authentication token, thereby creating a session cookie which can be used for subsequent requests






### `POST /token` — Create a user authentication token

Generate a fixed-duration authentication token for a particular user.

**Request headers**

* `X-Server-Token`: must be set to the secret key associated with the endpoint
* `X-Server-Id`: must be set to the identifier of the endpoint

**Parameters**

 Name | Type | Description
------|------|-------------
user | string | the user identifier
name | string | (optional) the full name of the user
email | string | (optional) the email address of the user
duration | integer | (optional) the number of days the new token will be valid (default: 1)

**Response**

```json
{
  "user": "my_user",
  "authToken": "00ff2913e48a443985a44c19c9502f5a",
  "expiresAt": "2016-04-28T00:00:00"
}
```






### `POST /login` — Log in

Session authentication uses HTTP Digest with a user authentication token.

To request via cURL: `curl --digest --user "Bearer:{authToken}" ...`

To request via AJAX: `$.ajax(..., user="Bearer", password="{authToken}")`

The response includes a `Set-Cookie` header to store session data:

* `user`







### `POST /logout` — Log out

Log out of the current session (clear session data)







### `GET /files` — List files

Get a list of the files the user can see. By default, only completed files are returned. However, the `status` parameter can be given to request files in a non-complete state.

**Parameters**

 Name | Type | Description
------|------|-------------
status | string | list files with the provided state (e.g., "complete", "corrupt", "cancelled")

**Response**

```json
{
  "files": [
    {
      "id": "c458f7af-c5b9-49c6-9b21-9b395efe19a5",
      "filename": "sample.bam",
      "sample": "sample",
      "state": "complete"
    }
  ]
}
```






### `POST /files/` — Create a new file

**Parameters**

 Name | Type | Description
------|------|-------------
filename | string | name of the file
total_size | integer | size of the file in bytes
sample | string | (optional) the sample name (only letters, numbers, underscores, and hyphens permitted)

**Response**

```json
{
  "id": "c458f7af-c5b9-49c6-9b21-9b395efe19a5",
  "filename": "sample.bam"
}
```

* `200 OK` if file is created
* `400 Bad Request` if the file could not be created







### `PUT /files/{id}` — Upload small file

Upload data for the file with the given identifier in a single request (appropriate  for small files less than 10 MB or so).

**Parameters**

 Name | Type | Description
------|------|-------------
file | file data | the contents of the file, multipart/form-data encoded








### `PUT /files/{id}/metadata` — Update file metadata

**Parameters**

 Name | Type | Description
------|------|-------------
sample | string | Description
total_chunks | integer | Description
total_size | integer | Description
filename | string | Description
file_type | string | Description
readset | string | Description
library | string | Description
run_type | string | Description
platform | string | Description
capture_kit | string | Description
reference | string | Description

* `200 OK` if the metadata was updated successfully






### `POST /files/{id}/upload` — Begin transfer of file

**Parameters**

 Name | Type | Description
------|------|-------------
total_chunks | integer | Description

**Response**

* `200 OK` if the file was opened for transferring





### `DELETE /files/{id}/upload` — Cancel transfer of file

Cancel the upload of the file.

**Response**

* `200 OK` if the transfer was cancelled successfully
* `400 Bad Request` if the file is not being transferred or the transfer cannot be cancelled
* `404 Not Found` if the file is not found






### `HEAD /files/{id}/upload/chunks/{n}` — Check chunk

Check if chunk #n of the file has already been uploaded to the server. Used by flow.js to resume an upload.

**Response**

* `200 OK` if the chunk is already uploaded
* `204 No Content` if the chunk has not yet been uploaded
* `400 Bad Request` if the request is invalid






### `PUT /files/{id}/upload/chunks/{n}` — Upload chunk

Upload chunk #n of the file.

**Parameters**

 Name | Type | Description
------|------|-------------
file | file data | The contents of the chunk, multipart/form-data encoded

**Response**

* `200 OK` if the chunk was uploaded successfully
* `202 Accepted` if the file is not open for uploading   !!!FIXME!!!
* `204 No Content` if the chunk has not yet been uploaded
* `400 Bad Request` if the request is invalid
* `415 Unsupported Media Type` if the entire file is invalid, based on this chunk
* `500 Internal Server Error` if the chunk could not be saved





### `POST /files/{id}/validate` — Validate file

Validate the integrity and correctness of the uploaded file (via checksum, gzip decompression, BAM EOF marker, etc.). For multi-part files, this may trigger a merge of the chunks.

**Parameters**

 Name | Type | Description
------|------|-------------
md5 | string | (optional) MD5 sum of the file

* Note: the MD5 sum can be computed incrementally while uploading via flow.js, e.g. with [SparkMD5](https://github.com/satazor/js-spark-md5).

**Response**

* `200 OK` if the file appears complete and valid
* `400 Bad Request` if the file is not being uploaded
* `415 Unsupported Media Type` if the file is invalid
* `500 Internal Server Error` if an error occurred processing the file





### `GET /samples/` — List samples

Get the list of samples the user can access.

```json
{
  "samples": [
    {
      "sample": "sample"
    }
  ]
}
```





### `GET /samples/{id}/files` — List files for a sample

Get the list of files within the given sample that the user can access.
