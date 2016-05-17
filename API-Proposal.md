## API Proposal





### `POST /server` — Create a new authorized server

Load the database with a new server and server-token

**Request headers**

(Use secret/admin key for authenticating the creation of new servers?)

**Parameters**

 Name | Type | Description
------|------|-------------
server name | string | the server name (will be used for generating corresponding user IDs)
server id | string | unique identifier for the server
server token | string | will be used for authenticating the generation user auth-tokens

**Response**

* `200 OK` if the server was successfully added
* `400 Bad Request` if the server id is already in use





### `GET /server/{server-id}/users` — View the server users

Get a list of the users belonging to a particular server.

**Request headers**

(Same secret/admin key for viewing users belonging to a server?)

**Response**

```json
{
  "users": [
    {
      "id": "jsmith",
      "name": "John Smith",
      "email": "jsmith@email.com"
    }
  ]
}
```





### `POST /user` — Create a new user

Create a new user belonging to an authorized server.

**Request headers**

* `X-Server-Token`: must belong to an existing authorized server

**Parameters**

 Name | Type | Description
------|------|-------------
id | string | the user id
name | string | the full name of the user
email | string | the email address of the user

**Response**

* `200 OK` if the user was successfully added
* `400 Bad Request` if the request is invalid





### `POST /user/{user-id}/access` — Create a user authentication token

Generate a fixed-duration authentication token for a particular user.

**Request headers**

* `X-Server-Token`: must belong to an existing authorized server

**Parameters**

 Name | Type | Description
------|------|-------------
duration | integer | (optional) the number of days the new token will be valid (default: 1)

**Response**

```json
{
  "user": "jsmith",
  "authToken": "00ff2913e48a443985a44c19c9502f5a",
  "expiresAt": "2016-04-28T00:00:00"
}
```





### `GET /user/{user-id}/access` — View user's auth-tokens

Get a list of the auth-tokens belonging to a particular user.

**Request headers**

* `X-Server-Token`: must belong to an existing authorized server

**Response**

```json
{
  "authTokens": [
    {
      "authToken": "00ff2913e48a443985a44c19c9502f5a",
      "creationDate": "2016-04-28T00:00:00",
      "expirationDate": "2016-04-29T00:00:00"
    }
  ]
}
```





### `GET /user/{user-id}/samples` — View user's samples

Get a list of the samples belonging to a particular user.

**Request headers**

* `X-Server-Token`: must belong to an existing authorized server

**Response**

```json
{
  "samples": [
    {
      "sampleName": "sample"
    }
  ]
}
```





### `GET /user/{user-id}/files` — View user's files

**Request headers**

* `X-Server-Token`: must belong to an existing authorized server

Get a list of the files the user can see. By default, only completed files are returned. However, the `status` parameter can be given to request files in a non-complete state.

**Parameters**

 Name | Type | Description
------|------|-------------
status | string | list files with the provided state (e.g., "complete", "corrupt", "cancelled", "ongoing")

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





### `GET /user/{user-id}/runs` — View user's pipeline runs
### `GET /access/{auth-token}/files` — View auth-token files
### `POST /sample` — Create a new sample
### `GET /sample/{sample-id}/files` — View sample files
### `POST /file` — Create a new file
### `PUT /file/{file-id}/metadata` — Update file metadata
### `PUT /file/{file-id}/upload` — Change status to ongoing
### `DELETE /file/{file-id}/upload` — Change status to cancelled
### `HEAD /file/{file-id}/upload/chunks/{chunk-number}` — Check for a chunk
### `PUT /file/{file-id}/upload/chunks/{chunk-number}` — Upload a chunk
