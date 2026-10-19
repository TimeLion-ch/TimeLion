# TimeLion API

Base path: `/api`. Requests and responses are JSON.

This file documents **implemented** endpoints only. Planned endpoints are specified in [roadmap.md](../roadmap.md) and move here when they are implemented.

## Conventions

- Request bodies must be JSON objects sent with `Content-Type: application/json` (otherwise `415`). The server reads at most 80 KiB: a larger body, or a larger `Content-Length`, gets `413` without being read further.
- Authentication uses capability tokens in the `Authorization: Bearer <token>` header (admin token or edit token). Tokens never appear in URLs. A `401` carries `WWW-Authenticate: Bearer`.
- The API sends no CORS headers, so pages on other origins can't read its responses, and browsers won't send them JSON requests (the preflight `OPTIONS` request gets `405`).
- Timestamps are Unix seconds (integer, UTC).
- IDs are 32 lowercase hex characters.
- Every response carries `Cache-Control: no-store` and restrictive security headers.
- The server never decrypts anything. Ciphertext fields are opaque strings in the envelope format described in [CLAUDE.md](../CLAUDE.md#encryption-design).

### Formats and limits

| What                 | Rule                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------- |
| ID                   | `^[0-9a-f]{32}$`. A malformed ID in a path returns `404 not_found`, like an unknown or expired one |
| Token                | `^[A-Za-z0-9_-]{43}$` (32 random bytes, base64url without padding)                           |
| Ciphertext           | `^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{24,}$`. The server checks the format, never the content |
| Poll ciphertext      | at most 65,536 bytes (64 KiB)                                                                |
| Response ciphertext  | at most 16,384 bytes (16 KiB)                                                                |
| Request body         | at most 81,920 bytes (80 KiB), otherwise `413`                                               |
| `expiresAt`          | an integer, later than now and at most 365 days (31,536,000 seconds) from now                |

The limits are constants in `src/Polls/Limits.php`. Unknown fields in a request body are ignored.

### Rate limits

Write endpoints count requests per client IP in fixed one-hour windows that start at full UTC hours. Every request counts, including rejected ones. Reading (`GET`) is not limited.

| Limit            | Requests per hour | Endpoints                                                      |
| ---------------- | ----------------- | -------------------------------------------------------------- |
| `create_poll`    | 20                | `POST /api/polls`                                              |
| `write_response` | 60                | `POST`, `PUT` and `DELETE` on `/api/polls/{id}/responses…`     |
| `admin_write`    | 120               | `PATCH` and `DELETE /api/polls/{id}`                           |

Over the limit, the API answers **429** `too_many_requests` with a `Retry-After` header: the seconds until the next window. The server stores no IP addresses, only an HMAC of action and IP under a key that changes every UTC day. Behind a reverse proxy, set `trusted_proxy_header` in config.php (see config.example.php). The limits are in `src/Security/RateLimit.php`.

### Order of checks

When several things are wrong with a request, the first failing check decides the error:

1. rate limit: `429` (write endpoints)
2. token format: `401` (endpoints that need a token)
3. path IDs, then the poll and response lookup: `404`
4. token match: `403`
5. body: `415`, `413`, then `400`
6. the poll's state: `409`

### Errors

Every error has the same shape:

```json
{ "error": { "code": "not_found", "message": "Not found." } }
```

`code` is stable and meant for the frontend to switch on. `message` is English text for developers and never contains user data. With `'env' => 'dev'` in config.php, `error.details` also contains the exception chain.

| Status | `code`                                            | When                                                   |
| ------ | ------------------------------------------------- | ------------------------------------------------------ |
| 400    | `bad_request`, `invalid_json`, or a specific code | Malformed input                                        |
| 401    | `unauthorized`                                    | Token missing or malformed                             |
| 403    | `forbidden`                                       | Token not valid for this resource                      |
| 404    | `not_found`                                       | Unknown route, or the resource does not exist or has expired |
| 405    | `method_not_allowed`                              | Wrong HTTP method (the `Allow` header lists valid ones) |
| 409    | specific, e.g. `poll_closed`                      | Conflicts with the current state                       |
| 413    | `payload_too_large`                               | Body exceeds the endpoint's limit                      |
| 415    | `unsupported_media_type`                          | Body is not `application/json`                         |
| 429    | `too_many_requests`                               | Rate limit reached (`Retry-After` header)              |
| 500    | `internal_error`                                  | Unexpected server error (logged on the server)         |

## Endpoints

### `GET /api/health`

Checks that the application boots and the database answers. The deploy smoke test uses it.

**200**

```json
{ "status": "ok" }
```

**500** `internal_error` if the database is unreachable or the configuration is invalid.

### `POST /api/deploy/migrate`

Applies pending database migrations. The FTP deploy uses it because the webspace has no shell to run `bin/migrate.php` (see [CLAUDE.md → Deployment](../CLAUDE.md#deployment)). It is not part of the app's API.

Authorization is a one-time token: the deploy job uploads the token's SHA-256 hex hash to `var/deploy-token`, then sends `Authorization: Bearer <token>` (43 base64url characters). The server deletes the file before it migrates, so each token works once. No request body.

**200**, with the versions applied by this call (empty if the database was up to date):

```json
{ "applied": ["0001_create_polls_and_responses"] }
```

| Status | `code`             | When                                                                                         |
| ------ | ------------------ | -------------------------------------------------------------------------------------------- |
| 404    | `not_found`        | No deploy is pending (no `var/deploy-token`). Checked first, so the endpoint stays hidden between deploys |
| 401    | `unauthorized`     | Token missing or malformed                                                                   |
| 403    | `forbidden`        | Token does not match the pending hash. The file stays, so the right token still works        |
| 500    | `migration_failed` | The token file could not be deleted, or a migration failed. `message` gives the reason       |

### `POST /api/polls`

Creates a poll. The client encrypts the poll document with a new poll key before sending it; the server generates the ID and the admin token, and stores only the token's SHA-256 hash. Rate limit: `create_poll`.

**Request**

```json
{ "ciphertext": "v1.AAECAwQFBgcICQoL.…", "expiresAt": 1800604800 }
```

| Field        | Type    | Rules                                                     |
| ------------ | ------- | --------------------------------------------------------- |
| `ciphertext` | string  | ciphertext envelope, at most 64 KiB                       |
| `expiresAt`  | integer | Unix seconds, later than now, at most 365 days from now   |

**201**

```json
{ "id": "3f2a…(32 hex)", "adminToken": "…(43 base64url)", "createdAt": 1800000000, "expiresAt": 1800604800 }
```

`adminToken` appears only in this response: the server can't show it again. The client keeps it in the admin link (`#k={key}&a={adminToken}`).

| Status | `code`                   | When                                                   |
| ------ | ------------------------ | ------------------------------------------------------ |
| 400    | `invalid_json`           | Body is not a JSON object                              |
| 400    | `invalid_ciphertext`     | `ciphertext` is missing, not a string, or not an envelope |
| 400    | `ciphertext_too_large`   | `ciphertext` is longer than 64 KiB                     |
| 400    | `invalid_expiry`         | `expiresAt` is missing, not an integer, not in the future, or more than 365 days ahead |
| 413    | `payload_too_large`      | Body is larger than 80 KiB                             |
| 415    | `unsupported_media_type` | Body is not `application/json`                         |

### `GET /api/polls/{id}`

Returns a poll with all its responses. No token is needed: anyone with the link can read the poll, and the server returns only ciphertext.

**200**

```json
{
  "id": "3f2a…",
  "ciphertext": "v1.…",
  "createdAt": 1800000000,
  "updatedAt": 1800000000,
  "expiresAt": 1800604800,
  "closedAt": null,
  "responses": [{ "id": "9c1d…", "ciphertext": "v1.…", "createdAt": 1800000100, "updatedAt": 1800000100 }]
}
```

`closedAt` is `null` while the poll is open. `responses` is ordered by `createdAt`, oldest first; responses created in the same second are ordered by `id`.

| Status | `code`      | When                                                                                         |
| ------ | ----------- | -------------------------------------------------------------------------------------------- |
| 404    | `not_found` | The ID is malformed, unknown or expired. The three cases return identical responses       |

A poll is expired from the second `expiresAt` on.

### `PATCH /api/polls/{id}`

Changes a poll. Requires `Authorization: Bearer <adminToken>`. Rate limit: `admin_write`.

**Request:** any non-empty subset of these fields.

```json
{ "ciphertext": "v1.…", "expiresAt": 1801209600, "closed": true }
```

| Field        | Type    | Rules                                                                                     |
| ------------ | ------- | ----------------------------------------------------------------------------------------- |
| `ciphertext` | string  | replaces the poll document; ciphertext envelope, at most 64 KiB                           |
| `expiresAt`  | integer | Unix seconds, later than now, at most 365 days from now. It may also move the expiry earlier |
| `closed`     | boolean | `true` closes the poll (closing a closed poll keeps the original `closedAt`), `false` reopens it |

All fields are validated before anything is stored, so an invalid field changes nothing. Every successful request sets `updatedAt`. A closed poll can still be changed.

**200**

```json
{ "id": "3f2a…", "updatedAt": 1800000500, "expiresAt": 1801209600, "closedAt": 1800000500 }
```

| Status | `code`                   | When                                                          |
| ------ | ------------------------ | ------------------------------------------------------------- |
| 400    | `empty_patch`            | None of `ciphertext`, `expiresAt` and `closed` is present     |
| 400    | `invalid_ciphertext`, `ciphertext_too_large`, `invalid_expiry` | As for `POST /api/polls`  |
| 400    | `invalid_field`          | `closed` is not a boolean                                     |
| 400    | `invalid_json`           | Body is not a JSON object                                     |
| 401    | `unauthorized`           | Token missing or malformed                                    |
| 403    | `forbidden`              | Token is not this poll's admin token                          |
| 404    | `not_found`              | The poll ID is malformed, unknown or expired                  |
| 413    | `payload_too_large`      | Body is larger than 80 KiB                                    |
| 415    | `unsupported_media_type` | Body is not `application/json`                                |

### `DELETE /api/polls/{id}`

Deletes a poll and all its responses, immediately and for good. Requires `Authorization: Bearer <adminToken>`. No request body. Rate limit: `admin_write`.

**204**, with no body.

| Status | `code`         | When                                         |
| ------ | -------------- | -------------------------------------------- |
| 401    | `unauthorized` | Token missing or malformed                   |
| 403    | `forbidden`    | Token is not this poll's admin token         |
| 404    | `not_found`    | The poll ID is malformed, unknown or expired |

### `POST /api/polls/{id}/responses`

Adds a response. No token is needed: anyone with the link can answer. The client encrypts the response with the poll key; the server generates the response ID and an edit token, and stores only the token's SHA-256 hash. Rate limit: `write_response`.

**Request**

```json
{ "ciphertext": "v1.…" }
```

`ciphertext`: ciphertext envelope, at most 16 KiB.

**201**

```json
{ "id": "9c1d…(32 hex)", "editToken": "…(43 base64url)", "createdAt": 1800000100 }
```

`editToken` appears only in this response. The client keeps it (device store, personal edit link) to change or delete the response later.

| Status | `code`                   | When                                                     |
| ------ | ------------------------ | -------------------------------------------------------- |
| 400    | `invalid_ciphertext`, `ciphertext_too_large`, `invalid_json` | Invalid body         |
| 404    | `not_found`              | The poll ID is malformed, unknown or expired             |
| 409    | `poll_closed`            | The poll is closed                                       |
| 409    | `too_many_responses`     | The poll already has 500 responses                       |
| 413    | `payload_too_large`      | Body is larger than 80 KiB                               |
| 415    | `unsupported_media_type` | Body is not `application/json`                           |

The limit check and the insert are not atomic: concurrent requests can take a poll a few responses past 500.

### `PUT /api/polls/{id}/responses/{responseId}`

Replaces a response. Requires `Authorization: Bearer <editToken>` of this response; the admin token is not accepted. Rate limit: `write_response`.

**Request:** `{ "ciphertext": "v1.…" }`, at most 16 KiB.

**200**

```json
{ "id": "9c1d…", "updatedAt": 1800000200 }
```

| Status | `code`                   | When                                                                     |
| ------ | ------------------------ | ------------------------------------------------------------------------ |
| 400    | `invalid_ciphertext`, `ciphertext_too_large`, `invalid_json` | Invalid body                         |
| 401    | `unauthorized`           | Token missing or malformed                                               |
| 403    | `forbidden`              | Token is not this response's edit token                                  |
| 404    | `not_found`              | An ID is malformed, the poll is unknown or expired, or the response does not exist in this poll |
| 409    | `poll_closed`            | The poll is closed                                                       |
| 413    | `payload_too_large`      | Body is larger than 80 KiB                                               |
| 415    | `unsupported_media_type` | Body is not `application/json`                                           |

### `DELETE /api/polls/{id}/responses/{responseId}`

Deletes a response. Requires `Authorization: Bearer <token>` with either the response's edit token or the poll's admin token. Allowed on closed polls. No request body. Rate limit: `write_response`.

**204**, with no body.

| Status | `code`         | When                                                                     |
| ------ | -------------- | ------------------------------------------------------------------------ |
| 401    | `unauthorized` | Token missing or malformed                                               |
| 403    | `forbidden`    | Token is neither this response's edit token nor the poll's admin token   |
| 404    | `not_found`    | An ID is malformed, the poll is unknown or expired, or the response does not exist in this poll |
