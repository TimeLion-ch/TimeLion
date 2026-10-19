# TimeLion roadmap

The plan for turning the foundation into a working, privacy-first scheduling tool. It is written so that an AI coding agent (or a human) can work through it **one task per iteration**. Architecture, conventions and the non-negotiable rules are in [CLAUDE.md](CLAUDE.md); this file only says _what_ to build next.

## How to work on this roadmap

Each iteration:

1. **Pick** the first open task (`- [ ]`) whose dependencies are done. Tasks run in order within a phase. Don't skip ahead or bundle tasks. A task marked 🧭 needs a human decision: ask, record the answer in the decision log, then continue.
2. **Read** CLAUDE.md and the code the task touches. If the task is unclear or conflicts with CLAUDE.md, ask instead of guessing.
3. **Branch:** `roadmap/<task-id>-<slug>`, e.g. `roadmap/1.1-poll-schema`.
4. **Implement** the task, including its tests. Stay within its scope. Add anything unrelated you notice to the [Inbox](#inbox) instead of fixing it now.
5. **Verify:** `composer check` and `npm --prefix frontend run verify` pass. For UI tasks, also run the browser and CSP check from CLAUDE.md → Definition of done.
6. **Document:** update `docs/api.md` for API changes, and CLAUDE.md if a convention or the architecture changed.
7. **Tick** the checkbox and append `— done YYYY-MM-DD`, plus one line the next task should know if there is something.
8. **Commit and open a PR** titled `<task-id>: <title>`, one task per PR. Merging to `main` deploys to production.

If a task grows beyond roughly 400 changed lines (not counting tests and lock files), first split it here into lettered subtasks (`3.2a`, `3.2b`, …), commit that split, then do the first subtask.

## Decision log

| #   | Decision                                                                                                                                | Date       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| D1  | Stack: Slim 4 PHP API plus a Svelte 5 single-file frontend, deployed by GitHub Actions to a shared webspace with rsync over SSH           | 2026-10-18 |
| D2  | End-to-end encryption: the key travels in the URL fragment and the server stores only ciphertext. Losing the link means losing the poll. | 2026-10-18 |
| D3  | No accounts and no cookies; access rights are random tokens (admin token, edit tokens)                                                   | 2026-10-18 |
| D4  | IDs are 128-bit random lowercase hex (32 chars); tokens are 256-bit random base64url (43 chars); the server stores SHA-256 hashes of tokens | 2026-10-18 |
| D5  | German copy uses Swiss spelling (ss) and the informal "du"; German is the default language                                              | 2026-10-18 |
| D6  | The webspace offers FTP only, so the deploy uses FTP with mandatory TLS (lftp) and runs migrations via a one-time-token endpoint. Replaces "rsync over SSH" in D1 | 2026-10-18 |
| D7  | The maximum poll lifetime (`MAX_LIFETIME`) is 365 days: `expiresAt` may be at most 365 days after the request that sets it        | 2026-10-19 |

Decisions still open are marked 🧭 on the tasks that need them: legal page details (4.2), security contact (4.3), license (4.5), notifications (6.6).

## Phase 0: Foundation ✅

- [x] **0.1** Replace the Symfony skeleton with a Slim 4 API: Kernel, Config, PDO, Migrator, JSON errors, security headers, `GET /api/health`, plus PHPUnit, PHPStan and PHP-CS-Fixer — done 2026-10-18
- [x] **0.2** Single-file Svelte 5 frontend (router, de/en i18n, API client, storage helper, header, footer, home, 404) and a build step that hashes the inline code for the CSP — done 2026-10-18
- [x] **0.3** GitHub Actions: CI on PHP 8.3–8.5 plus the frontend, and deploy over rsync/SSH with migrations and a smoke test — done 2026-10-18
- [x] **0.4** CLAUDE.md, docs/api.md, README and this roadmap — done 2026-10-18

## Phase 1: Backend API

**The API contract for this phase.** Implement it exactly, and copy each endpoint into `docs/api.md` when it lands.

- **Limits:** poll ciphertext ≤ 64 KiB; response ciphertext ≤ 16 KiB; request body ≤ 80 KiB; at most 500 responses per poll; `expiresAt` must be later than now and at most `MAX_LIFETIME` (365 days, D7) from now.
- **Ciphertext format** (the server checks it but never decrypts): `^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{24,}$`
- **ID format** (check it before any database access): `^[0-9a-f]{32}$`. Malformed IDs return `404 not_found`, the same as unknown or expired ones.

Tasks:

- [x] **1.0 Run the backend tests against MySQL in CI** — done 2026-10-19
  - Production runs MySQL/MariaDB, so the schema must be tested there too. Let `AppTestCase` and the repository tests read an optional `TIMELION_TEST_DSN` (plus user and password) environment variable, defaulting to `sqlite::memory:`. When MySQL is used, recreate the schema between tests.
  - Add a MariaDB service container (`mariadb:11`) to the `backend` job, as one extra matrix entry rather than for every PHP version.
  - Done when: CI runs the suite on SQLite and MariaDB and both pass.
  - Next: `AppTestCase` puts a migrated `TestDatabase` connection into the container (`$this->pdo`); repository tests use `TestDatabase::migrated()`.
- [x] **1.1 Schema: polls and responses** — done 2026-10-19 (D7: 365 days)
  - Add `migrations/0001_create_polls_and_responses.sql` with the tables from CLAUDE.md → Data model, an index on `polls(expires_at)`, an index on `responses(poll_id)`, and the foreign key with `ON DELETE CASCADE`.
  - Add a `TimeLion\Polls\Limits` class (or similar) holding the contract limits above as constants, including `MAX_LIFETIME`.
  - Done when: the migration applies on SQLite and MariaDB (1.0), and a test proves the cascade delete.
  - Next: the limits are constants on `TimeLion\Polls\Limits`; `MAX_LIFETIME` is in seconds.
- [x] **1.2 Security primitives** — done 2026-10-19
  - `src/Security/Random.php`: `id()` returns 32 lowercase hex characters; `token()` returns 43 base64url characters (32 bytes).
  - `src/Security/TokenHash.php`: `hash(string $token)` returns the SHA-256 hex digest; `matches(string $token, string $hash)` compares with `hash_equals`.
  - `src/Http/BearerToken.php`: `fromRequest(ServerRequestInterface)` accepts `Bearer` case-insensitively, requires the base64url charset and length 43, and otherwise throws `ApiError::unauthorized()`.
  - Add a `src/Clock.php` interface with `SystemClock`, registered in the Kernel container, and a `FrozenClock` for tests.
  - Done when: unit tests cover formats, hash matching, and header parsing edge cases (missing, `Basic …`, wrong length, extra spaces).
  - `TokenHash` and `BearerToken` already exist with tests (added early for 5.4); `Random` and the clock are still open.
  - Next: `Random` is static; `AppTestCase` registers a `FrozenClock` as `$this->clock` (default 1,800,000,000, `advance()` moves it).
- [ ] **1.3 Input validation helpers**
  - Add validation helpers (e.g. `src/Http/Validate.php`): `ciphertext($value, int $maxBytes)`, `expiresAt($value, int $now)`, `bool($value, string $field)`.
  - They throw `ApiError::badRequest` with `invalid_ciphertext`, `ciphertext_too_large`, `invalid_expiry` or `invalid_field`.
  - Done when: data-provider tests cover valid and invalid values, including wrong types, empty strings and boundary sizes.
- [ ] **1.4 Repositories**
  - `src/Repository/PollRepository.php` and `src/Repository/ResponseRepository.php`, using PDO with prepared statements: `insert`, `findActive($id, $now)` (which excludes expired polls), `update`, `delete`, `setClosed`, `countForPoll`, `listForPoll`.
  - Done when: repository tests cover expiry filtering, the cascade and ordering.
- [ ] **1.5 `POST /api/polls`: create a poll**
  - Body: `{ "ciphertext": string, "expiresAt": int }`. Response: **201** `{ "id", "adminToken", "createdAt", "expiresAt" }`.
  - The server generates the ID and the admin token and stores only the token's hash.
  - Done when: HTTP tests cover success, every validation error, an oversized body and a wrong content type, and `docs/api.md` is updated.
- [ ] **1.6 `GET /api/polls/{id}`: read a poll**
  - **200** `{ "id", "ciphertext", "createdAt", "updatedAt", "expiresAt", "closedAt": int|null, "responses": [{ "id", "ciphertext", "createdAt", "updatedAt" }] }`, with responses ordered by `createdAt`.
  - Unknown, malformed and expired IDs all return **404** `not_found` and are indistinguishable.
  - Done when: tests cover expired polls and responses belonging to other polls not leaking in.
- [ ] **1.7 Admin: `PATCH` and `DELETE /api/polls/{id}`**
  - Both require `Authorization: Bearer <adminToken>`.
  - `PATCH` body: any subset of `ciphertext`, `expiresAt` and `closed` (bool). It returns **200** `{ "id", "updatedAt", "expiresAt", "closedAt" }`.
  - `DELETE` returns **204** and cascades.
  - Errors: 401 for a missing or malformed token, 403 for a wrong token, 404 for an unknown or expired poll, 400 for an empty patch.
  - Done when: every status code has a test, and tokens are compared via `TokenHash::matches`.
- [ ] **1.8 Responses: `POST /api/polls/{id}/responses`, `PUT` and `DELETE /api/polls/{id}/responses/{responseId}`**
  - `POST` body `{ "ciphertext" }` returns **201** `{ "id", "editToken", "createdAt" }`. It returns **409** `poll_closed` if the poll is closed, and **409** `too_many_responses` once the limit is reached.
  - `PUT` requires the response's edit token. Body `{ "ciphertext" }` returns **200** `{ "id", "updatedAt" }`, or **409** `poll_closed`.
  - `DELETE` returns **204** and accepts either the response's edit token **or** the poll's admin token. It is allowed even when the poll is closed.
  - Done when: tests cover every path, including a response ID that belongs to a different poll (404).
- [ ] **1.9 Purging expired polls**
  - Add `src/Maintenance/Purger.php`, which deletes expired polls (cascading) and stale rate-limit rows (after 1.10). It runs with about 2% probability per API request (middleware, after the handler) and via `bin/purge.php` for hosts that offer cron.
  - Done when: tests with `FrozenClock` pass, and README and CLAUDE.md mention the optional cron job.
- [ ] **1.10 Rate limiting**
  - Migration: `rate_limits(bucket CHAR(64) PK, window_start BIGINT, hits INTEGER)`.
  - Bucket: `HMAC-SHA256(dailyKey, action + "|" + clientIp)`, where `dailyKey = HMAC-SHA256(config secret, "rate-limit|" + UTC date)`.
  - The client IP comes from `REMOTE_ADDR`. Add an optional config `trusted_proxy_header` (default: none) for hosts behind a reverse proxy.
  - Fixed windows per hour: creating polls 20, writing responses 60, admin writes 120. Keep these as tunable constants.
  - Over the limit: **429** `too_many_requests` with a `Retry-After` header.
  - Done when: tests cover reaching the limit, the window reset and independent IPs, and assert that the table never contains a raw IP.
- [ ] **1.11 API hardening review**
  - For every endpoint, check that limits are enforced, IDs are validated before database access, errors are consistent, no user data reaches the logs, and `docs/api.md` is complete. Add `composer audit --no-dev` to CI.
  - Done when: findings are fixed or added as tasks.

## Phase 2: Frontend logic (no UI yet)

Tasks 2.1–2.3 don't depend on Phase 1 and can run in parallel with it.

- [ ] **2.1 Crypto module** (`src/lib/base64url.ts`, `src/lib/crypto.ts`)
  - `generatePollKey()`, `exportKey(key)` (base64url), `importKey(string)`, `encryptJson(key, kind, value)` (returns the envelope string) and `decryptJson(key, kind, envelope)` (returns `unknown`), following CLAUDE.md → Encryption design exactly. Implement base64url in plain TypeScript, without `Buffer`.
  - Done when: Vitest covers the round trip, wrong key fails, tampered ciphertext fails, wrong `kind` fails, the envelope matches the backend regex, and IVs differ between calls.
- [ ] **2.2 Plaintext model and validation** (`src/lib/model.ts`)
  - Types plus hand-written validators (no schema library):
    - `Poll`: `{ v: 1, title (1–200 chars), description? (≤ 2000), location? (≤ 200), timezone (IANA name), options: [{ id (8 hex), start: 'YYYY-MM-DD' | ISO date-time, end? }] (1–100), allowMaybe: boolean, finalOptionId? }`
    - `Response`: `{ v: 1, name (1–80), votes: { [optionId]: 'yes' | 'maybe' | 'no' }, comment? (≤ 500) }`
  - The validators return the typed value or `null`. They drop unknown fields and ignore votes for unknown options.
  - Done when: tests cover valid input and hostile input (huge strings, wrong types, `__proto__` keys, deeply nested values).
- [ ] **2.3 Links** (`src/lib/links.ts`)
  - `participantLink(origin, id, key)`, `adminLink(origin, id, key, adminToken)` and `parseFragment(hash)`, which returns `{ key, adminToken?, edit?: { responseId, editToken } } | null`. The fragment uses `URLSearchParams` syntax.
  - Done when: tests cover round trips, garbage fragments, and missing or invalid keys.
- [ ] **2.4 Typed API client for the Phase 1 endpoints** (`src/lib/api.ts`). Depends on 1.5–1.8.
  - Add `api.createPoll`, `getPoll`, `updatePoll`, `deletePoll`, `createResponse`, `updateResponse` and `deleteResponse`, typed to match `docs/api.md`.
  - Done when: each has a test with mocked `fetch`.
- [ ] **2.5 Poll service** (`src/lib/polls.ts`). Depends on 2.1–2.4.
  - High-level functions that combine crypto, model and API: `createPoll(poll, expiresAt)` returns `{ id, key, adminToken }`; `loadPoll(id, key)` returns `{ poll, responses, skippedResponses, meta }`, skipping invalid responses instead of failing; also `submitResponse`, `editResponse`, `deleteResponse`, `updatePoll`, `closePoll` and `deletePoll`.
  - Done when: tests with a mocked API layer cover the full encrypt → store → load → decrypt path.
- [ ] **2.6 Device store** (`src/lib/deviceStore.ts`)
  - Polls this browser created or answered: `{ id, key, adminToken?, responses: [{ id, editToken }], title?, savedAt }[]`, stored under the localStorage key `timelion.polls.v1` via `storage.ts`. Also `forget(id)` and `forgetAll()`.
  - Done when: tests (with an in-memory storage stub) also show that corrupted stored content is ignored.

## Phase 3: User interface

Every UI task: all text goes in both locale files; there are no CSP violations; the layout works at 360 px width and in light and dark mode; it's keyboard accessible.

- [ ] **3.1 Create a poll: basics** (route `/new`, `src/routes/CreatePoll.svelte`). Depends on 2.5 and 2.6.
  - Fields: title, description and location; date selection via a month calendar (multi-select, keyboard accessible); expiry (default: 30 days after the last option, capped at `MAX_LIFETIME`).
  - Create the reusable components it needs in `src/components/` (Button, TextField, Notice, …).
  - On the home page, replace the "being rebuilt" notice with a "Create poll" button.
  - Submit: `polls.createPoll`, save to the device store, then navigate to the admin link.
  - Done when: creating a poll works end to end against `composer serve`.
- [ ] **3.2 Create a poll: time slots**
  - Optional time ranges per date ("all day" by default), a "copy times to all dates" action, and the timezone shown (default: the browser's).
- [ ] **3.3 Share screen**
  - Right after creation, show the participant link and admin link in copy fields (Clipboard API with a select-text fallback), with a clear warning that lost links cannot be recovered. It can be dismissed and appears only once per poll.
- [ ] **3.4 Poll page: viewing** (route `/p/:id`, 32-hex IDs only)
  - Load and decrypt the poll. Show the title, description and location, and an options × participants table with yes/maybe counts and the best option highlighted.
  - Error states: the link has no key; decryption fails ("link incomplete or wrong"); not found or expired; network error.
- [ ] **3.5 Voting**
  - Add a response (name plus yes/maybe/no per option, with maybe only if allowed), and edit or delete your own responses using the edit tokens from the device store. Closed polls are read-only.
- [ ] **3.6 Admin panel** (visible when the fragment contains an admin token)
  - Edit texts and options (warn that removing an option drops its votes), close and reopen, choose the final option, delete individual responses, and delete the poll (with confirmation).
- [ ] **3.7 Responsive and accessible results table**
  - Mobile layout (options as a list showing your own vote and the totals), keyboard navigation, screen-reader labels, and enough contrast in both themes.
- [ ] **3.8 My polls** (route `/my`, plus a "Meine Umfragen / My polls" link in the header, as in the old navbar)
  - List the polls from the device store (decrypting titles lazily), with open, forget and forget all. Explain that this list exists only in this browser.
- [ ] **3.9 Calendar export**
  - Download the final option as an `.ics` file (generated in the browser as a Blob, RFC 5545, with correct timezones), offered as an "Add to calendar" button on closed polls.
- [ ] **3.10 Personal edit link**
  - After voting, offer a link (`#k=…&r={responseId}.{editToken}`) for editing the response from another device, and handle it on the poll page.

## Phase 4: Privacy, legal, quality

- [ ] **4.1 End-to-end tests**
  - Playwright against `composer serve` with the built frontend, covering create → vote → edit → admin close → final option → delete. It also asserts that no request leaves the origin and that the console shows no CSP violations.
  - Run it as its own CI job.
- [ ] **4.2 Legal pages** 🧭 operator name, address, contact e-mail, hosting provider
  - Routes `/privacy` and `/imprint`, linked in the footer as in the old site ("Impressum", "Kontakt").
  - The privacy policy lists what is stored (ciphertext plus the metadata from CLAUDE.md) and the host's access logs and their retention. The wording should fit the Swiss nFADP and be available in German and English.
- [ ] **4.3 security.txt** 🧭 security contact
  - Add `public/.well-known/security.txt` (RFC 9116). The deploy currently excludes `public/.well-known/` from the upload (`.github/scripts/deploy-ftp.sh`). Decide whether this file is deployed from the repository, and adjust the exclude if so.
- [ ] **4.4 Security review**
  - Checklist: XSS (no `{@html}`, user URLs rendered as text), token handling, CSP still hash-only, headers on every response type, size and rate limits, error messages, and dependency audits (`composer audit`, `npm audit --omit=dev` in CI).
  - Done when: findings are fixed or added as tasks.
- [ ] **4.5 License** 🧭 keep GPL-3.0 or switch to AGPL-3.0
  - AGPL also requires anyone running a modified public instance to publish their changes, which fits a hosted privacy tool. Update LICENSE, `composer.json`, `frontend/package.json` and the README to match.
- [ ] **4.6 Logo license**
  - The lion SVG comes from SVG Repo. Check its license, then add attribution or replace it.
- [ ] **4.7 Brand font (optional)**
  - The old site used Plus Jakarta Sans (OFL) from Google Fonts. If it's wanted, embed a Latin-subset WOFF2 as a data URI (which needs `font-src data:` in the CSP). Budget: at most 40 KiB.

## Phase 5: Deployment hardening

- [ ] **5.1 First production deploy** (FTP only, see D6)
  - Set up the GitHub variables and the secret, the server directory, `config.php`, the document root and HTTPS, then deploy. Verify the smoke test, the response headers (curl) and the CSP in a browser.
  - Record the host's specifics (FTP server name, quirks) in CLAUDE.md.
- [ ] **5.2 Atomic releases**
  - Deploy to `releases/<sha>/` with a `current` symlink and the document root on `current/public`; share `config.php` and `var/` via symlinks; keep the last 3 releases; roll back by switching the symlink.
  - Only if the host supports a symlinked document root (test this first). FTP cannot create symlinks, so this is blocked while the host offers FTP only (D6).
- [ ] **5.3 Release package for self-hosters**
  - On `v*` tags, build a zip with `vendor/` and the built `public/`, attach it to a GitHub release, and describe installing from it in the README.
- [x] **5.4 FTP deploy** (the host has no SSH, D6) — done 2026-10-18
  - An FTP deploy action plus a token-protected, one-time migration endpoint.

## Phase 6: Later / ideas

- [ ] **6.1** French and Italian translations
- [ ] **6.2** Password-protected polls: the poll key is wrapped with a PBKDF2-derived key, so the link alone isn't enough
- [ ] **6.3** Sign-up sheet mode: a maximum number of participants per option
- [ ] **6.4** Hidden responses, where only the admin sees votes: responses encrypted to an admin public key (ECDH P-256 + AES-GCM) 🧭 needs a design review
- [ ] **6.5** Comments on polls
- [ ] **6.6** Notifications 🧭 this means storing e-mail addresses, a privacy trade-off; perhaps opt-in "someone voted" mails without content
- [ ] **6.7** Reproducible builds and a published hash of `index.html`, so users can verify the code they are served

## Inbox

Things noticed during other tasks, to be sorted into the phases above:

- _(empty)_
