# TimeLion: guide for AI agents and contributors

TimeLion ([timelion.ch](https://timelion.ch)) is a privacy-focused meeting scheduler. Someone creates a poll with date and time options and shares the link. Participants answer yes, maybe or no for each option, and the group picks a date. Polls are **end-to-end encrypted in the browser**, so the server only ever stores ciphertext.

**Status:** the API, the frontend logic and the UI are done (roadmap Phases 0–3): polls can be created, answered, edited, closed and deleted. Of Phase 4, everything but the legal pages (4.2) is done: end-to-end tests, security.txt, the security review, the AGPL license, the logo license and the brand font. Further work follows [roadmap.md](roadmap.md). Read its "How to work on this roadmap" section before starting a task.

## Stack

| Layer         | Choice                                                                         | Notes                                                    |
| ------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Backend       | PHP ≥ 8.3, Slim 4, slim/psr7, PHP-DI 7                                         | JSON API under `/api` only; no server-rendered HTML      |
| Database      | PDO with plain SQL                                                             | MySQL/MariaDB in production, SQLite for dev and tests    |
| Migrations    | numbered `.sql` files, `bin/migrate.php`                                       | `src/Database/Migrator.php`                              |
| Frontend      | Svelte 5 (runes), TypeScript, Vite 8, vite-plugin-singlefile                   | builds **one** self-contained `public/index.html`        |
| Crypto        | WebCrypto, AES-GCM 256                                                         | no crypto libraries                                      |
| Dates         | `Intl.DateTimeFormat`                                                          | no date libraries                                        |
| Quality       | PHPUnit 12, PHPStan level max, PHP-CS-Fixer (PER-CS, tabs); Vitest, svelte-check, tsc, Prettier; Playwright (end-to-end) |                |
| CI/CD         | GitHub Actions; deploys over FTP with TLS (lftp) to a shared webspace          | `.github/workflows/ci.yml`                               |

The hosting target is an ordinary shared webspace: PHP, MySQL, Apache with `.htaccess`, and FTP. There is no SSH or shell, no Node on the server, no long-running processes and no root access. Anything that needs more than that is out of scope. Cron may be missing too, so expired data is purged after about 2% of API requests (`PurgeMiddleware`); where the host offers cron, `php bin/purge.php` can run as well, but nothing depends on it.

## Non-negotiable rules (privacy and security)

1. **The server never sees plaintext content.** Poll titles, descriptions, locations, options, participant names, votes and comments (everything a person types) are encrypted in the browser before they leave it. If a feature seems to need plaintext on the server, stop and ask (add a 🧭 decision to the roadmap).
2. **The poll key exists only in the URL fragment (`#…`) and in the browser** (localStorage for "my polls"). Never send it to the server, log it, or put it in a query string.
3. **No third-party requests.** No CDNs, Google Fonts, analytics, error trackers, embeds or external images. Everything is bundled into `index.html`, and the CSP enforces this.
4. **No cookies, accounts or sessions.** Access rights are random capability tokens.
5. **No personal data in logs or the database.** No IP addresses: rate limiting stores only an HMAC of the IP with a daily rotating key. No user agents, no request bodies. Only 5xx errors are logged, and without call arguments.
6. **Tokens:** store only SHA-256 hashes and compare them with `hash_equals`. Tokens travel in the `Authorization: Bearer` header, never in URLs.
7. **Decrypted data is untrusted.** Anyone with the link can write anything. Validate its shape after decrypting, render it as text, and never use `{@html}` with user data.
8. **Every poll expires.** Expired data is deleted, not hidden.
9. **Keep dependencies minimal.** Ask before adding a runtime dependency (a PHP `require` or anything bundled into the frontend, which goes into `dependencies` in `frontend/package.json`). Dev tools are fine when justified. CI audits the runtime dependencies (`composer audit --no-dev`, `npm audit --omit=dev`).
10. **Keep UI copy honest.** Never claim features or guarantees that don't exist.

## Architecture

### Request flow

```
Browser ── GET /, /p/{id}, … ─▶ Apache ─▶ public/index.html        (single-file Svelte app)
Browser ── fetch /api/* ──────▶ Apache ─▶ public/api/index.php ─▶ Slim (src/)
```
### Encryption design

- **Poll key:** a random 256-bit AES-GCM key (`crypto.subtle.generateKey`), exported raw and base64url-encoded (43 characters).
- **Links:**
  - participant link: `https://timelion.ch/p/{pollId}#k={key}`
  - admin link: `…#k={key}&a={adminToken}`
  - personal edit link (planned): `…#k={key}&r={responseId}.{editToken}`
- **Ciphertext envelope:** `v1.{base64url(iv)}.{base64url(ciphertext‖tag)}`. The IV is 12 random bytes, new for every encryption. The AAD is the UTF-8 string `timelion:v1:{kind}`, where `kind` is `poll` or `response`. The plaintext is UTF-8 JSON and is validated after decryption.
- **One key per poll** encrypts the poll document and all of its responses. Anyone with the participant link can read the whole poll.
- **The server generates IDs and tokens.**
  - Poll and response IDs: 16 random bytes as 32 **lowercase hex** characters. Hex because MySQL collations are case-insensitive.
  - Admin and edit tokens: 32 random bytes, base64url-encoded. The server stores only their SHA-256 hex hash.
- **What the server can see:** IDs, timestamps (created, updated, expires, closed), the number and size of responses, and IP addresses in the host's web server access logs, which are outside our control. Be honest about this in the privacy policy.
- **Known limitations:**
  - A compromised server could ship malicious JavaScript that leaks keys. The strict CSP, open source code and (later) reproducible builds reduce this risk but cannot remove it.
  - Losing the link means losing the poll. There is no recovery, by design.

### Data model (`migrations/0001`: polls and responses; `migrations/0002`: rate_limits)

```
polls       (id CHAR(32) PK, admin_token_hash CHAR(64), ciphertext MEDIUMTEXT,
             created_at, updated_at, expires_at, closed_at NULL)               -- BIGINT unix seconds
responses   (id CHAR(32) PK, poll_id → polls ON DELETE CASCADE, edit_token_hash CHAR(64),
             ciphertext TEXT, created_at, updated_at)
rate_limits (bucket CHAR(64) PK, window_start BIGINT, hits INTEGER)
```

## Repository layout

```
.htaccess                   the document root is the app root: rewrites every request into public/
.github/workflows/ci.yml    CI (PHP 8.3–8.5 on SQLite, PHP 8.3 on MariaDB, frontend, end-to-end) and deploy (main → FTP with TLS)
.github/scripts/            deploy-ftp.sh: upload over FTP, then migrations via one-time token
SECURITY.md                 how to report vulnerabilities (GitHub private reporting), scope
bin/migrate.php             apply migrations; --status lists them
bin/purge.php               delete expired data (optional cron job; requests also purge, see Maintenance/)
config.example.php          template for config.php (gitignored, lives only on the server), incl. the privacy policy text
dev/router.php              router for `php -S`; mirrors .htaccess, including the CSP
docs/api.md                 API reference: update it with every endpoint change
frontend/
  e2e/                      Playwright end-to-end tests; fixtures.ts (the guard), server.mjs + config.php (test server)
  htaccess.template         → public/.htaccess (CSP placeholders filled at build time)
  scripts/build-public.mjs  copies dist/index.html to public/, computes the CSP hashes (logic in csp.mjs)
  src/App.svelte            route switch
  src/assets/               favicon; fonts/ (Plus Jakarta Sans subset, OFL, how it was made)
  src/components/           UI components: building blocks (Button, TextField, Notice, ConfirmButton, CopyField,
                            Calendar) and the parts of the pages (PollForm, ResultsTable, VotePanel, AdminPanel, …)
  src/routes/               one component per page: Home, CreatePoll, PollPage, MyPolls, PrivacyPolicy, NotFound
  src/lib/                  logic: api.ts, base64url.ts, crypto.ts, dates.ts, deviceStore.ts, download.ts, errors.ts,
                            format.ts, i18n.ts + i18n.svelte.ts, ics.ts, links.ts, markup.ts, model.ts, pollDraft.ts, polls.ts,
                            responseDraft.ts, results.ts, routes.ts + router.svelte.ts, storage.ts
  src/locales/{de,en}.json  translations (de.json is the source of truth for keys)
migrations/                 NNNN_description.sql
public/                     web root on the server
  api/index.php             Slim front controller
  index.html, .htaccess     GENERATED by the frontend build (gitignored)
  .well-known/security.txt  security contact (RFC 9116); renew Expires yearly (tests/SecurityTxtTest.php)
  robots.txt
src/                        PHP, namespace TimeLion\
  Kernel.php                builds the container (also for bin/) and the Slim app: middleware, error handling
  Routes.php                all API routes
  Config.php                typed configuration from config.php
  Clock.php, SystemClock.php  injected time (tests use tests/FrozenClock.php)
  Database/                 ConnectionFactory, Migrator
  Deploy/                   DeployToken (one-time token for the FTP deploy's migration call)
  Http/                     ApiError, BearerToken, ClientIp, ErrorHandler, Json, Validate, PollAccess, Middleware/, Action/
  Maintenance/              Purger (deletes expired polls and stale rate-limit rows)
  Polls/                    Poll, PollResponse, Limits (the API contract's limits)
  Repository/               PollRepository, ResponseRepository, RateLimitRepository (all SQL lives here)
  Security/                 Random (IDs, tokens), TokenHash, RateLimit + RateLimiter (HMAC buckets, no IPs)
tests/                      PHPUnit; AppTestCase boots the app on a freshly migrated TestDatabase; Fixtures
var/                        runtime data (SQLite database, caches), gitignored
```

## Commands

First-time setup (Node 24 LTS, see `.nvmrc`; PHP 8.3+ with pdo_sqlite):

```bash
composer install
cp config.example.php config.php        # set 'env' => 'dev' and a 32+ character secret
php bin/migrate.php
npm --prefix frontend ci
npm --prefix frontend run build
```

| Command                                  | Purpose                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `composer serve`                         | API and built frontend on http://localhost:8000                               |
| `npm --prefix frontend run dev`          | Vite with hot reload on :5173; proxies `/api` to :8000, so it needs `composer serve` |
| `npm --prefix frontend run build`        | Build `public/index.html` and `public/.htaccess`                              |
| `composer check`                         | PHP code style, PHPStan and PHPUnit                                           |
| `composer cs:fix`                        | Fix PHP code style                                                            |
| `npm --prefix frontend run verify`       | Prettier check, svelte-check + tsc, Vitest, build                             |
| `npm --prefix frontend run e2e`          | Build, then Playwright on :8123 with a fresh SQLite database (`var/e2e.sqlite`); once before: `npx --prefix frontend playwright install chromium` |
| `npm --prefix frontend run format`       | Format the frontend code                                                      |
| `php bin/migrate.php [--status]`         | Apply or list migrations                                                      |
| `php bin/purge.php`                      | Delete expired polls now (optional cron job, e.g. hourly)                     |

## Backend conventions

- Use `declare(strict_types=1)`, `final` classes, `readonly` where possible, and tabs. PHPStan level max must pass without ignores or a baseline.
- Each endpoint is one invokable action class in `src/Http/Action/`, registered in `src/Routes.php`. Dependencies come in through the constructor (PHP-DI autowiring). SQL belongs in repository classes (`src/Repository/`, created in roadmap 1.4), not in actions.
- **Input:** call `Json::decodeBody($request, $maxBytes)` and validate every field explicitly. Report problems with `ApiError::badRequest('snake_case_code', 'English message')`.
- **Output:** use `Json::response()`. JSON field names are camelCase and SQL columns snake_case. Timestamps are integers (Unix seconds).
- **Errors:** throw `ApiError` (HTTP status plus a stable code). `ErrorHandler` renders `{"error": {"code", "message"}}` and logs only 5xx errors. Messages never contain user data.
- **Time and randomness:** inject a clock (roadmap 1.2) instead of calling `time()` in domain code, so expiry stays testable. Use only `random_bytes()`.
- Slim binds route closures to the container, so route closures in tests must not be `static`.
- Every endpoint gets an HTTP-level test in `tests/Http/` built on `AppTestCase`.
- Apache's `.htaccess` headers replace any header of the same name set by PHP (for example the CSP on API responses). Both versions are strict, so this is intended.

## Frontend conventions

- Use Svelte 5 runes only (`$state`, `$derived`, `$props`; `$effect` sparingly). `svelte.config.js` forces runes mode. TypeScript is strict, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Logic goes into plain `.ts` modules in `src/lib/` with Vitest tests next to them (`*.test.ts`). Reactive state lives in `*.svelte.ts` modules. Keep components thin.
- **No Node APIs in browser code** (`Buffer`, `node:*`). `tsconfig.json` deliberately has no Node types. Tests run in Node, so a Node API would pass the tests and then fail in the browser. Build scripts are covered by `tsconfig.node.json`.
- Routes are real paths (History API, `routes.ts` + `router.svelte.ts`), because the fragment is reserved for keys. Internal links use `<a href="/…" use:link>`. Add routes in `routes.ts` with tests and render them in `App.svelte`.
- **Never use `#` anchors** for jumping within a page: the fragment holds the key. `router.hash` is reactive, and `App.svelte` re-creates the poll page for every ID and fragment. Per-entry UI state that must survive a reload (the share screen after creating a poll) goes into history state (`navigate(path, { state })`, `router.state`).
- Forms edit a draft (`pollDraft.ts`, `responseDraft.ts`) that the lib turns into a document; validation errors show after the first submit and then follow every change. Irreversible actions go through `ConfirmButton`. Dates are `YYYY-MM-DD` strings with UTC arithmetic (`dates.ts`); option times are wall-clock times in the poll's timezone, formatted with `format.ts`.
- Texts that belong to the operator, such as the privacy policy, live in `config.php`, not in the repository: the API serves them (`GET /api/privacy-policy`), and `markup.ts` turns their small text format into blocks that components render as text. The privacy policy is German only; the English UI says so.
- All UI text goes through `t('key')` from `i18n.svelte.ts`. Add each key to every file in `src/locales/`; a test enforces identical keys and placeholders. German copy uses Swiss spelling (ss, never ß) and the informal "du".
- **CSS:** global tokens live in `src/app.css`; components use scoped `<style>` blocks. **No `style="…"` attributes in markup**, because the hash-based CSP blocks them. Use classes, or `style:` directives where something must be dynamic. SVG colours use presentation attributes (`fill="…"`). The colour tokens meet WCAG AA in both themes (text 4.5:1, focus ring and control borders 3:1); keep it that way. The font is Plus Jakarta Sans, a Latin subset with weights 400–800 that the build inlines as a `data:` URI (`font-src data:` in the CSP); `src/assets/fonts/README.md` says how to rebuild it, and it stays under 40 KiB. The layout must work at 360 px; text from polls gets `overflow-wrap: anywhere`. Absolutely positioned content (such as `.visually-hidden`) inside a scroll box needs a positioned ancestor, or it widens the page.
- API calls go only through `src/lib/api.ts`; pass tokens with the `token` option. localStorage goes only through `src/lib/storage.ts`, which never throws. Treat everything stored there as optional.
- Components handle poll data through `src/lib/polls.ts`, which encrypts before sending and validates after decrypting (`model.ts`), not through `crypto.ts` or the poll endpoints of `api.ts`. Links are built and parsed in `links.ts`; the polls saved in this browser (keys and tokens) go through `deviceStore.ts`.
- Prettier formats everything (tabs, single quotes, 120-character lines).
- End-to-end tests (`e2e/*.spec.ts`) import `test` and `expect` from `e2e/fixtures.ts`. Its guard fails a test on a CSP violation, an uncaught error or a request to another origin (which it also blocks); `newPage()` opens another person's browser with its own storage. Use roles and labels from `en.json` as selectors (the tests run in `en-GB`).

## Database conventions

- Migrations are `migrations/NNNN_description.sql`, applied in order and recorded in `schema_migrations`. **Never edit a migration that has been applied**; add a new one.
- Write portable SQL that runs on both SQLite and MySQL/MariaDB:
  - no `ENGINE=`, `AUTO_INCREMENT`, backticks, `ENUM` or `CHARACTER SET`
  - use `CHAR`/`VARCHAR`, `TEXT`/`MEDIUMTEXT`, `BIGINT`, `INTEGER`
  - one statement per `;` at the end of a line; no triggers or procedures
- MySQL's default collations are case-insensitive, so IDs and hashes are lowercase hex. Never rely on case-sensitive comparison in SQL.
- Use prepared statements only; never interpolate values into SQL.
- Use foreign keys with `ON DELETE CASCADE`, so that deleting a poll deletes everything that belongs to it.
- Tests run on in-memory SQLite by default. `tests/TestDatabase.php` reads `TIMELION_TEST_DSN`, `TIMELION_TEST_DB_USER` and `TIMELION_TEST_DB_PASSWORD` to run them against MySQL/MariaDB instead, as one CI entry does. It drops every table before each test, so point it at a dedicated, empty database:

  ```bash
  docker run -d --name timelion-test-mariadb -p 127.0.0.1:3307:3306 -e MARIADB_ROOT_PASSWORD=root \
    -e MARIADB_DATABASE=timelion_test -e MARIADB_USER=timelion -e MARIADB_PASSWORD=timelion mariadb:11
  TIMELION_TEST_DSN='mysql:host=127.0.0.1;port=3307;dbname=timelion_test;charset=utf8mb4' \
    TIMELION_TEST_DB_USER=timelion TIMELION_TEST_DB_PASSWORD=timelion composer test
  ```

## API conventions

All requests go under `/api`, with JSON in and out; request bodies need `Content-Type: application/json`. Errors use the format `{"error": {"code", "message"}}`. Authentication is `Authorization: Bearer <token>`: a missing or malformed token returns 401, a wrong token 403. Every response sends `Cache-Control: no-store`. **The full reference is [docs/api.md](docs/api.md); keep it current.**

## Definition of done

A change is done when:

1. `composer check` and `npm --prefix frontend run verify` pass.
2. New behaviour has tests: PHPUnit HTTP tests for endpoints, Vitest for TypeScript logic, and Playwright (`frontend/e2e/`) for new user flows.
3. The docs are updated: `docs/api.md` for API changes, this file when conventions or architecture change, and the checkbox in `roadmap.md`.
4. For UI changes: `npm --prefix frontend run e2e` passes (it fails on **CSP violations** and requests to other origins), and you used the change via `composer serve`. For a page the end-to-end tests don't open, check the console yourself; headless on macOS (no output means no violation):

   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --enable-logging=stderr --v=0 \
     --virtual-time-budget=3000 --dump-dom http://localhost:8000/ 2>&1 >/dev/null | grep -i "content security policy"
   ```

## Deployment

The webspace offers FTP only, with no SSH, so there is no shell on the server. A push to `main` runs CI, then the deploy job. The deploy job runs only if the repository variable `DEPLOY_URL` is set. It:

1. runs `composer install --no-dev` and the frontend build. `COMPOSER_ROOT_VERSION` keeps the commit hash out of `vendor/`, so `vendor/` changes only when its contents do.
2. assembles `release/` from `.htaccess`, `bin/`, `migrations/`, `public/`, `src/`, `vendor/`, `config.example.php` and an empty `var/`
3. runs [.github/scripts/deploy-ftp.sh](.github/scripts/deploy-ftp.sh), which:
   - mirrors `release/` to `DEPLOY_FTP_PATH` with lftp, over FTP with mandatory TLS and a verified certificate. It deletes remote files that are not in the release, except `config.php`, the contents of `var/`, and the host's `.well-known/` and `.user.ini` in the app root and in `public/`. Of `public/.well-known/`, only `security.txt` comes from the release. Files are uploaded under a temporary name and renamed, and `public/index.html` and `public/.htaccess` go up last, back to back, because the CSP holds the hashes of `index.html`.
   - skips `vendor/` when a SHA-256 over all of its files matches `vendor/.deploy-hash` on the server. The script deletes that file before it uploads `vendor/` and writes it again afterwards, so an interrupted upload is redone. The hash includes the classmap that Composer generates for `src/`, so adding or renaming a class uploads `vendor/` again.
   - creates a random one-time token, uploads its SHA-256 hash to `var/deploy-token` and calls `POST DEPLOY_URL/api/deploy/migrate` with it ([docs/api.md](docs/api.md)). The server deletes the file and runs the migrations, and the endpoint answers 404 again until the next deploy.
4. runs a smoke test against `DEPLOY_URL/api/health` and `DEPLOY_URL/`, checks that a file in the app root (`config.example.php`) is not served, and that `/.well-known/security.txt` is served as UTF-8 text

There is no atomic switch: files are replaced one by one, and the new code runs against the old schema until the migration call. Keep migrations compatible with that, for example by adding columns instead of renaming them.

The script also runs locally (it needs lftp, curl and openssl), which helps when debugging a deploy. Its header lists the environment variables.

Configure this under Settings → Secrets and variables → Actions, at the **repository level**. Environment-level variables are not visible to the job's `if`.

| Kind     | Name                  | Value                                                                                                  |
| -------- | --------------------- | ------------------------------------------------------------------------------------------------------ |
| Secret   | `DEPLOY_FTP_HOST`     | FTP server name **that matches its TLS certificate**. A secret, so the public Actions logs mask it.    |
| Secret   | `DEPLOY_FTP_USER`     | FTP user. A secret, so the public Actions logs mask it.                                                |
| Variable | `DEPLOY_FTP_PATH`     | app root as the FTP user sees it, e.g. `/timelion`                                                     |
| Variable | `DEPLOY_FTP_PORT`     | optional, default `21` (explicit TLS)                                                                  |
| Variable | `DEPLOY_URL`          | public base URL, e.g. `https://timelion.ch`; enables the deploy job; used by migrations and smoke test |
| Secret   | `DEPLOY_FTP_PASSWORD` | FTP password                                                                                           |

One-time server setup:

1. Make `DEPLOY_FTP_PATH` the domain's document root, and a **dedicated** directory: the deploy deletes everything else in it except the host's `.well-known/` and `.user.ini`.
2. The host doesn't let us point the document root to `public/`, so the root `.htaccess` rewrites every request into `public/`. Nothing outside `public/` may be reachable from the web, and the smoke test checks this. On a host that allows it, point the document root to `DEPLOY_FTP_PATH/public` instead; Apache then ignores the root `.htaccess`.
3. Create `config.php` locally from `config.example.php` with `prod`, the database credentials, a secret and the privacy policy (fill in every `[placeholder]`), and upload it to `DEPLOY_FTP_PATH/config.php`. A changed privacy policy only needs this file uploaded again, no deploy.
4. Make sure the server has HTTPS (hosting panel), PHP ≥ 8.3 with pdo_mysql, and Apache with mod_rewrite and mod_headers. PHP must be able to delete files in `var/`, or the migration call fails with `migration_failed`.
5. Set `display_errors` to off in the host's PHP settings (hosting panel or `.user.ini`). `public/api/index.php` switches it off as well, but PHP prints warnings from before that line, e.g. for a POST larger than `post_max_size`, into the response, as HTML with server paths.

**Pushing to `main` deploys to production.** Work on branches and merge through pull requests.

Third-party actions in `ci.yml` (only `shivammathur/setup-php` so far) are pinned to a commit, with the release as a comment, so a moved tag can't change what runs next to the deploy secrets. Update them deliberately.

## Rules for agents

- Work through `roadmap.md` in order, one task per branch and pull request.
- Ask before you add dependencies, change the crypto design or link format, change what the server stores, or touch anything marked 🧭.
- Never commit `config.php`, `.env`, `public/index.html` or `public/.htaccess`.
