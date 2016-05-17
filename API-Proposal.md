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





### `GET /user/{user-id}/access` — 
### `GET /user/{user-id}/samples` — 
### `GET /user/{user-id}/files` —
### `GET /user/{user-id}/runs` — 
### `GET /access/{auth-token}/files` —
### `POST /sample` — 
### `GET /sample/{sample-id}/files` — 
### `POST /file` —
### `PUT /file/{file-id}/metadata` —
### `PUT /file/{file-id}/upload` —
### `DELETE /file/{file-id}/upload` —
### `HEAD /file/{file-id}/upload/chunks/{chunk-number}` —
### `PUT /file/{file-id}/upload/chunks/{chunk-number}` —
