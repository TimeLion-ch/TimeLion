# TimeLion API

Base path: `/api`. Requests and responses are JSON.

This file documents **implemented** endpoints only. Planned endpoints are specified in [roadmap.md](../roadmap.md) and move here when they are implemented.

## Conventions

- Request bodies must be JSON objects sent with `Content-Type: application/json` (otherwise `415`).
- Authentication uses capability tokens in the `Authorization: Bearer <token>` header (admin token or edit token). Tokens never appear in URLs.
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

Creates a poll. The client encrypts the poll document with a new poll key before sending it; the server generates the ID and the admin token, and stores only the token's SHA-256 hash.

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
