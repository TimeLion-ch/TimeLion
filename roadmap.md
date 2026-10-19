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
| D8  | Security contact: GitHub private vulnerability reporting, in `security.txt` and `SECURITY.md`; no e-mail address is published         | 2026-10-19 |
| D9  | License: AGPL-3.0-only instead of GPL-3.0-only, so that whoever runs a modified public instance must publish their changes           | 2026-10-19 |

Decisions still open are marked 🧭 on the tasks that need them: legal page details (4.2), notifications (6.6).

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
- [x] **1.3 Input validation helpers** — done 2026-10-19
  - Add validation helpers (e.g. `src/Http/Validate.php`): `ciphertext($value, int $maxBytes)`, `expiresAt($value, int $now)`, `bool($value, string $field)`.
  - They throw `ApiError::badRequest` with `invalid_ciphertext`, `ciphertext_too_large`, `invalid_expiry` or `invalid_field`.
  - Done when: data-provider tests cover valid and invalid values, including wrong types, empty strings and boundary sizes.
  - Next: patterns need the `D` modifier, or `$` also matches before a trailing newline (the ID check in 1.6 too).
- [x] **1.4 Repositories** — done 2026-10-19
  - `src/Repository/PollRepository.php` and `src/Repository/ResponseRepository.php`, using PDO with prepared statements: `insert`, `findActive($id, $now)` (which excludes expired polls), `update`, `delete`, `setClosed`, `countForPoll`, `listForPoll`.
  - Done when: repository tests cover expiry filtering, the cascade and ordering.
  - Next: `PollRepository::update(Poll)` writes all mutable columns including `closed_at`, so there is no separate `setClosed`. Response lookups always take `(pollId, id)`. Entities are `Polls\Poll` and `Polls\PollResponse`; `tests/Fixtures.php` builds them.
- [x] **1.5 `POST /api/polls`: create a poll** — done 2026-10-19
  - Body: `{ "ciphertext": string, "expiresAt": int }`. Response: **201** `{ "id", "adminToken", "createdAt", "expiresAt" }`.
  - The server generates the ID and the admin token and stores only the token's hash.
  - Done when: HTTP tests cover success, every validation error, an oversized body and a wrong content type, and `docs/api.md` is updated.
  - Next: `AppTestCase` has `requestJson()`, `assertError()` and `errorCode()`; docs/api.md has a "Formats and limits" table.
- [x] **1.6 `GET /api/polls/{id}`: read a poll** — done 2026-10-19
  - **200** `{ "id", "ciphertext", "createdAt", "updatedAt", "expiresAt", "closedAt": int|null, "responses": [{ "id", "ciphertext", "createdAt", "updatedAt" }] }`, with responses ordered by `createdAt`.
  - Unknown, malformed and expired IDs all return **404** `not_found` and are indistinguishable.
  - Done when: tests cover expired polls and responses belonging to other polls not leaking in.
  - Next: actions get route arguments as `array<string, string> $args`; `Validate::id($args['id'] ?? '')` throws the 404. `AppTestCase` has `polls()` and `responses()`.
- [x] **1.7 Admin: `PATCH` and `DELETE /api/polls/{id}`** — done 2026-10-19
  - Both require `Authorization: Bearer <adminToken>`.
  - `PATCH` body: any subset of `ciphertext`, `expiresAt` and `closed` (bool). It returns **200** `{ "id", "updatedAt", "expiresAt", "closedAt" }`.
  - `DELETE` returns **204** and cascades.
  - Errors: 401 for a missing or malformed token, 403 for a wrong token, 404 for an unknown or expired poll, 400 for an empty patch.
  - Done when: every status code has a test, and tokens are compared via `TokenHash::matches`.
  - Next: `Http\PollAccess` does the lookup and token check in the documented order (401 → 404 → 403); the body comes after. `AppTestCase` has `newPoll()` and `bearer()`.
- [x] **1.8 Responses: `POST /api/polls/{id}/responses`, `PUT` and `DELETE /api/polls/{id}/responses/{responseId}`** — done 2026-10-19
  - `POST` body `{ "ciphertext" }` returns **201** `{ "id", "editToken", "createdAt" }`. It returns **409** `poll_closed` if the poll is closed, and **409** `too_many_responses` once the limit is reached.
  - `PUT` requires the response's edit token. Body `{ "ciphertext" }` returns **200** `{ "id", "updatedAt" }`, or **409** `poll_closed`.
  - `DELETE` returns **204** and accepts either the response's edit token **or** the poll's admin token. It is allowed even when the poll is closed.
  - Done when: tests cover every path, including a response ID that belongs to a different poll (404).
  - Next: the response limit is count-then-insert, not atomic, so concurrent requests can pass it by a few (documented). Every write endpoint now exists for 1.10 to rate-limit.
- [x] **1.9 Purging expired polls** — done 2026-10-19
  - Add `src/Maintenance/Purger.php`, which deletes expired polls (cascading) and stale rate-limit rows (after 1.10). It runs with about 2% probability per API request (middleware, after the handler) and via `bin/purge.php` for hosts that offer cron.
  - Done when: tests with `FrozenClock` pass, and README and CLAUDE.md mention the optional cron job.
  - Next: `Purger::purge()` returns counts per table (`['polls' => n]`); 1.10 adds the rate-limit rows. `AppTestCase` turns random purging off. `Kernel::createContainer()` serves bin/ scripts.
- [x] **1.10 Rate limiting** — done 2026-10-19
  - Migration: `rate_limits(bucket CHAR(64) PK, window_start BIGINT, hits INTEGER)`.
  - Bucket: `HMAC-SHA256(dailyKey, action + "|" + clientIp)`, where `dailyKey = HMAC-SHA256(config secret, "rate-limit|" + UTC date)`.
  - The client IP comes from `REMOTE_ADDR`. Add an optional config `trusted_proxy_header` (default: none) for hosts behind a reverse proxy.
  - Fixed windows per hour: creating polls 20, writing responses 60, admin writes 120. Keep these as tunable constants.
  - Over the limit: **429** `too_many_requests` with a `Retry-After` header.
  - Done when: tests cover reaching the limit, the window reset and independent IPs, and assert that the table never contains a raw IP.
  - Next: each write action calls `RateLimiter::hit()` first, so rejected requests count too. `ApiError` can carry headers (`Retry-After`). Response deletes by the admin count as `write_response`.
- [x] **1.11 API hardening review** — done 2026-10-19
  - For every endpoint, check that limits are enforced, IDs are validated before database access, errors are consistent, no user data reaches the logs, and `docs/api.md` is complete. Add `composer audit --no-dev` to CI.
  - Done when: findings are fixed or added as tasks.
  - Fixed: bodies were read into memory in full before the size check (a 300 MB body exhausted `memory_limit`), now at most 80 KiB + 1 byte is read; 401 now carries `WWW-Authenticate: Bearer`; `index.php` turns off `display_errors` and call arguments in PHP's own traces; CLAUDE.md asks for `display_errors` off on the host. No other findings; IPv6 rate limits are in the Inbox.

## Phase 2: Frontend logic (no UI yet)

Tasks 2.1–2.3 don't depend on Phase 1 and can run in parallel with it.

- [x] **2.1 Crypto module** (`src/lib/base64url.ts`, `src/lib/crypto.ts`) — done 2026-10-19
  - `generatePollKey()`, `exportKey(key)` (base64url), `importKey(string)`, `encryptJson(key, kind, value)` (returns the envelope string) and `decryptJson(key, kind, envelope)` (returns `unknown`), following CLAUDE.md → Encryption design exactly. Implement base64url in plain TypeScript, without `Buffer`.
  - Done when: Vitest covers the round trip, wrong key fails, tampered ciphertext fails, wrong `kind` fails, the envelope matches the backend regex, and IVs differ between calls.
  - Next: every decryption failure (malformed envelope, wrong key or kind, tampering, plaintext that isn't UTF-8 JSON) throws `DecryptionError`. `importKey` rejects with `TypeError` unless the key is 43 canonical base64url characters (`KEY_PATTERN`), and imported keys are not extractable.
- [x] **2.2 Plaintext model and validation** (`src/lib/model.ts`) — done 2026-10-19
  - Types plus hand-written validators (no schema library):
    - `Poll`: `{ v: 1, title (1–200 chars), description? (≤ 2000), location? (≤ 200), timezone (IANA name), options: [{ id (8 hex), start: 'YYYY-MM-DD' | ISO date-time, end? }] (1–100), allowMaybe: boolean, finalOptionId? }`
    - `Response`: `{ v: 1, name (1–80), votes: { [optionId]: 'yes' | 'maybe' | 'no' }, comment? (≤ 500) }`
  - The validators return the typed value or `null`. They drop unknown fields and ignore votes for unknown options.
  - Done when: tests cover valid input and hostile input (huge strings, wrong types, `__proto__` keys, deeply nested values).
  - Next: the types are `Poll`, `PollOption` and `PollResponse` (not `Response`, which would shadow the DOM type); `parseResponse(value, poll)` needs the poll for its option IDs. An option's `start` is `YYYY-MM-DD` or a wall-clock `YYYY-MM-DDTHH:MM` in the poll's `timezone`, without offset; `end` has the same form and is later (for days: the inclusive last day). An unknown `finalOptionId` is dropped. `limits` has the field lengths (UTF-16 code units, like `maxlength`).
- [x] **2.3 Links** (`src/lib/links.ts`) — done 2026-10-19
  - `participantLink(origin, id, key)`, `adminLink(origin, id, key, adminToken)` and `parseFragment(hash)`, which returns `{ key, adminToken?, edit?: { responseId, editToken } } | null`. The fragment uses `URLSearchParams` syntax.
  - Done when: tests cover round trips, garbage fragments, and missing or invalid keys.
  - Next: `editLink(origin, id, key, responseId, editToken)` exists too, for 3.10. `parseFragment` returns null only for a missing or malformed key; a malformed admin token or edit part is left out. `KEY_PATTERN` (crypto.ts) now also rejects a non-canonical last character.
- [x] **2.4 Typed API client for the Phase 1 endpoints** (`src/lib/api.ts`). Depends on 1.5–1.8. — done 2026-10-19
  - Add `api.createPoll`, `getPoll`, `updatePoll`, `deletePoll`, `createResponse`, `updateResponse` and `deleteResponse`, typed to match `docs/api.md`.
  - Done when: each has a test with mocked `fetch`.
  - Next: methods take positional arguments, tokens before bodies (`updatePoll(id, adminToken, patch)`, `updateResponse(pollId, responseId, editToken, ciphertext)`). A malformed ID rejects with `ApiError(404, 'not_found')` without a request. `serverLimits` mirrors `Limits.php`, including `maxLifetime` for 3.1.
- [x] **2.5 Poll service** (`src/lib/polls.ts`). Depends on 2.1–2.4. — done 2026-10-19
  - High-level functions that combine crypto, model and API: `createPoll(poll, expiresAt)` returns `{ id, key, adminToken }`; `loadPoll(id, key)` returns `{ poll, responses, skippedResponses, meta }`, skipping invalid responses instead of failing; also `submitResponse`, `editResponse`, `deleteResponse`, `updatePoll`, `closePoll` and `deletePoll`.
  - Done when: tests with a mocked API layer cover the full encrypt → store → load → decrypt path.
  - Next: the functions take the key as the base64url string from the link or device store. `submitResponse(id, key, poll, response)` and `editResponse(id, key, poll, responseId, editToken, response)` need the loaded poll for its option IDs; documents are validated before encrypting (`TypeError` if invalid). `loadPoll` throws `UnreadablePollError` for a malformed or wrong key or an invalid poll; `skippedResponses` holds the IDs of unreadable responses. `reopenPoll` exists next to `closePoll`.
- [x] **2.6 Device store** (`src/lib/deviceStore.ts`) — done 2026-10-19
  - Polls this browser created or answered: `{ id, key, adminToken?, responses: [{ id, editToken }], title?, savedAt }[]`, stored under the localStorage key `timelion.polls.v1` via `storage.ts`. Also `forget(id)` and `forgetAll()`.
  - Done when: tests (with an in-memory storage stub) also show that corrupted stored content is ignored.
  - Next: use `deviceStore` with `savePoll(id, key, { adminToken?, title? })` after creating or opening a poll, `saveResponse(pollId, key, { id, editToken })` after voting and `forgetResponse()` after deleting a response; `list()` is most recent first. `savedAt` is Unix seconds. `ID_PATTERN` and `TOKEN_PATTERN` live in api.ts.

## Phase 3: User interface

Every UI task: all text goes in both locale files; there are no CSP violations; the layout works at 360 px width and in light and dark mode; it's keyboard accessible.

- [x] **3.1 Create a poll: basics** (route `/new`, `src/routes/CreatePoll.svelte`). Depends on 2.5 and 2.6. — done 2026-10-19
  - Fields: title, description and location; date selection via a month calendar (multi-select, keyboard accessible); expiry (default: 30 days after the last option, capped at `MAX_LIFETIME`).
  - Create the reusable components it needs in `src/components/` (Button, TextField, Notice, …).
  - On the home page, replace the "being rebuilt" notice with a "Create poll" button.
  - Submit: `polls.createPoll`, save to the device store, then navigate to the admin link.
  - Done when: creating a poll works end to end against `composer serve`.
  - Next: `PollForm` edits a `PollDraft` (`bind:draft`); `buildPoll(draft)` makes the document and `expiresAt(draft, now)` the expiry. After creating, the page navigates to the admin link, which has no route until 3.3/3.4.
  - Split, because it is over 400 lines:
    - [x] **3.1a Building blocks**: colour tokens and base form styles in `app.css`, `Button`, `TextField` and `Notice`, plus `lib/dates.ts` (date arithmetic and timezones), `lib/format.ts` (`Intl` formatting) and `lib/errors.ts` (error messages). — done 2026-10-19
      - Next: dates are `YYYY-MM-DD` strings with UTC arithmetic; `zonedToUtc(date, time, timeZone)` converts wall-clock times. `format.ts` uses de-CH and en-GB. `errorMessage(error)` returns a message key. `Button` with `href` renders an internal link.
    - [x] **3.1b Month calendar**: `components/Calendar.svelte`, multi-select and keyboard accessible. — done 2026-10-19
    - [x] **3.1c The `/new` page**: `lib/pollDraft.ts` (form state → poll document and expiry), `PollForm`, `CreatePoll`, the route and the button on the home page. — done 2026-10-19
- [x] **3.2 Create a poll: time slots** — done 2026-10-19
  - Optional time ranges per date ("all day" by default), a "copy times to all dates" action, and the timezone shown (default: the browser's).
  - Next: a `DraftDay` has `slots` (`{ start, end }` as `HH:MM`, the end optional); an end before the start is on the next day. `DayList` edits them; `PollForm` validates live after the first submit.
- [x] **3.3 Share screen** — done 2026-10-19
  - Right after creation, show the participant link and admin link in copy fields (Clipboard API with a select-text fallback), with a clear warning that lost links cannot be recovered. It can be dismissed and appears only once per poll.
  - Next: the route `poll` (`/p/{id}`) renders `PollPage`. "Just created" is history state (`navigate(path, { state: { created: true } })`, read as `router.state`), so the share screen survives a reload but not dismissal (`replaceState({})`). Outside it, `PollPage` still shows the 404 page until 3.4.
- [x] **3.4 Poll page: viewing** (route `/p/:id`, 32-hex IDs only) — done 2026-10-19
  - Load and decrypt the poll. Show the title, description and location, and an options × participants table with yes/maybe counts and the best option highlighted.
  - Error states: the link has no key; decryption fails ("link incomplete or wrong"); not found or expired; network error.
  - Next: `ResultsTable` takes the poll and the loaded responses; the best options score 2 per yes and 1 per maybe (`results.ts`). Absolutely positioned content inside a scroll box needs a positioned box (`position: relative`), or it widens the page.
  - Split, because it is over 400 lines:
    - [x] **3.4a Loading and error states**: the route loads and decrypts the poll, saves it to the device store, shows the title, description, location and status, and the four error states. — done 2026-10-19
      - Next: `router.hash` is reactive and `App.svelte` re-creates `PollPage` for every ID and fragment. `loadProblem(error)` (errors.ts) sorts load errors.
    - [x] **3.4b Results table**: `lib/results.ts` (tallies, best option) and the options × participants table with totals and comments. — done 2026-10-19
- [x] **3.5 Voting** — done 2026-10-19
  - Add a response (name plus yes/maybe/no per option, with maybe only if allowed), and edit or delete your own responses using the edit tokens from the device store. Closed polls are read-only.
  - Next: `PollPage` keeps this browser's responses as `own` (device store) and reloads with `load()`; `VotePanel` takes them. `ConfirmButton` asks before anything that can't be undone.
  - Split, because it is over 400 lines:
    - [x] **3.5a Adding a response**: `lib/responseDraft.ts`, the voting form and the panel that sends it and saves the edit token to the device store. — done 2026-10-19
    - [x] **3.5b Editing and deleting your responses**: the list of this browser's responses with edit and delete (`ConfirmButton`), and "you" in the table. — done 2026-10-19
- [x] **3.6 Admin panel** (visible when the fragment contains an admin token) — done 2026-10-19
  - Edit texts and options (warn that removing an option drops its votes), close and reopen, choose the final option, delete individual responses, and delete the poll (with confirmation).
  - Next: `draftFromPoll(poll, expiresAt)` and `editedPoll(previous, draft)` keep option IDs; `removedOptions` finds what an edit drops. The admin panel is a disclosure (collapsed by default) below the poll's notices. Local UI tests can hit the hourly rate limits (`DELETE FROM rate_limits` in the dev database).
  - Split, because it is over 400 lines:
    - [x] **3.6a Admin actions**: close and reopen, choose the final option, delete individual (also unreadable) responses, delete the poll, and both links. — done 2026-10-19
    - [x] **3.6b Editing the poll**: the poll form for an existing poll, keeping option IDs (and so the votes) of unchanged options, with a warning before options with votes are removed. — done 2026-10-19
- [x] **3.7 Responsive and accessible results table** — done 2026-10-19
  - Mobile layout (options as a list showing your own vote and the totals), keyboard navigation, screen-reader labels, and enough contrast in both themes.
  - Next: below 40rem `ResultsList` replaces `ResultsTable` (CSS only); comments are in `CommentList`. The table's scroll box is a focusable region, so the keyboard can scroll it. Text contrast is at least 4.5:1 and the focus ring and form borders at least 3:1 in both themes.
- [x] **3.8 My polls** (route `/my`, plus a "Meine Umfragen / My polls" link in the header, as in the old navbar) — done 2026-10-19
  - List the polls from the device store (decrypting titles lazily), with open, forget and forget all. Explain that this list exists only in this browser.
  - Next: only entries without a stored title are loaded, one after another, so the server doesn't see every poll of this browser at once. Below 25rem the header shows the logo without the name.
- [x] **3.9 Calendar export** — done 2026-10-19
  - Download the final option as an `.ics` file (generated in the browser as a Blob, RFC 5545, with correct timezones), offered as an "Add to calendar" button on closed polls.
  - Next: `buildIcs` writes times in UTC (no VTIMEZONE needed) and whole days as dates; the file never contains the poll's link. A Blob download needs no CSP change.
- [x] **3.10 Personal edit link** — done 2026-10-19
  - After voting, offer a link (`#k=…&r={responseId}.{editToken}`) for editing the response from another device, and handle it on the poll page.
  - Next: opening a personal link saves its token in the device store (only if the response still exists) and opens the response in the form.

## Phase 4: Privacy, legal, quality

- [x] **4.1 End-to-end tests** — done 2026-10-19
  - Playwright against `composer serve` with the built frontend, covering create → vote → edit → admin close → final option → delete. It also asserts that no request leaves the origin and that the console shows no CSP violations.
  - Run it as its own CI job.
  - Next: `npm --prefix frontend run e2e` builds, then runs Chromium against `php -S` (dev/router.php) on :8123 with a fresh `var/e2e.sqlite`. Tests use `test` from `e2e/fixtures.ts`: its guard fails on CSP violations, uncaught errors and requests to other origins, and `newPage()` opens a second browser. The poll test also checks that no request carries the key or any plaintext. The deploy waits for the job.
- [ ] **4.2 Legal pages** 🧭 operator name, address, contact e-mail, hosting provider
  - Routes `/privacy` and `/imprint`, linked in the footer as in the old site ("Impressum", "Kontakt").
  - The privacy policy lists what is stored (ciphertext plus the metadata from CLAUDE.md) and the host's access logs and their retention. The wording should fit the Swiss nFADP and be available in German and English.
  - From 4.4: it also says that the browser keeps the links, with the key and any admin token, in its history (which browsers may sync) and that "My polls" keeps them in this browser's storage.
- [x] **4.3 security.txt** — done 2026-10-19 (D8: GitHub private vulnerability reporting)
  - Add `public/.well-known/security.txt` (RFC 9116). The deploy currently excludes `public/.well-known/` from the upload (`.github/scripts/deploy-ftp.sh`). Decide whether this file is deployed from the repository, and adjust the exclude if so.
  - Next: the file is deployed from the repository (the only file of `public/.well-known/` that is); the smoke test fetches it. Its `Expires` is renewed by hand, and `tests/SecurityTxtTest.php` fails 30 days before it passes. `SECURITY.md` is its policy. Private vulnerability reporting must be on in the GitHub repository settings (Security → Private vulnerability reporting).
- [x] **4.4 Security review** — done 2026-10-19
  - Checklist: XSS (no `{@html}`, user URLs rendered as text), token handling, CSP still hash-only, headers on every response type, size and rate limits, error messages, and dependency audits (`composer audit`, `npm audit --omit=dev` in CI).
  - Done when: findings are fixed or added as tasks.
  - Fixed: `npm audit --omit=dev` checked nothing, because `svelte`, whose runtime is bundled, was a dev dependency; it is in `dependencies` now and CI audits it. Poll texts could put control characters into the `.ics` file; `escapeText` drops them. The dev router sent only three of the page headers, so local runs and the end-to-end tests saw fewer than Apache sends; it now sends all of them from `public/.htaccess`. `shivammathur/setup-php`, the only third-party action and one that runs in the deploy job, is pinned to a commit. Two regexes got the `D` modifier for consistency (neither was exploitable).
  - New regression tests: the CSP template stays hash-only (Vitest), every kind of API response carries the API headers (PHPUnit), and the page carries its headers (Playwright).
  - Checked without findings: there are no HTML sinks, and poll texts (URLs included) render as text; the only dynamic link comes from validated device-store IDs and keys. Tokens travel only in the `Authorization` header, are stored as hashes and compared with `hash_equals`. The API sends no CORS headers and uses no cookies. Every write is rate-limited and size-checked before parsing. Error messages carry no request data.
  - Added as tasks: the browser history note in 4.2. IPv6 rate limits were already in the Inbox.
- [x] **4.5 License** — done 2026-10-19 (D9: AGPL-3.0)
  - AGPL also requires anyone running a modified public instance to publish their changes, which fits a hosted privacy tool. Update LICENSE, `composer.json`, `frontend/package.json` and the README to match.
  - Next: LICENSE is the text from gnu.org. The footer's "Source code" link is how timelion.ch offers the source (section 13); the README tells self-hosters to point it to their version.
- [x] **4.6 Logo license** — done 2026-10-19
  - The lion SVG comes from SVG Repo. Check its license, then add attribution or replace it.
  - Result: it is ["Lion"](https://www.svgrepo.com/svg/484717/lion) (collection "SVG Vector", uploaded by SVG Repo), CC0 per its page (checked in the archived copy of 2025-07-11, as the live page blocks scripts). No attribution is needed; the source is noted in `Logo.svelte` and the README anyway. The favicon and `docs/logo_sm.png` are the same lion.
  - Next: CC0 means anyone may use this lion too, so it can't become an exclusive trademark, and the CC0 label rests on SVG Repo's word alone. If TimeLion ever needs a protectable mark, commission its own logo.
- [x] **4.7 Brand font (optional)** — done 2026-10-19
  - The old site used Plus Jakarta Sans (OFL) from Google Fonts. If it's wanted, embed a Latin-subset WOFF2 as a data URI (which needs `font-src data:` in the CSP). Budget: at most 40 KiB.
  - Next: a variable subset (weights 400–800, Google's "latin" range, `tnum` for the tables) of 19 KiB adds 25 KiB to `index.html`. `src/assets/fonts/README.md` has the source and the commands. An end-to-end test checks that it loads under the CSP.

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

- Rate limits (1.10) count IPv6 clients per full address, so a client with a /64 prefix can switch addresses to get fresh limits. Consider counting IPv6 per /64 (the bucket would then cover the prefix, not the address).
