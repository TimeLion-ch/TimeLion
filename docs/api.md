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
