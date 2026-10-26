# TimeLion roadmap

The work still planned for TimeLion. It is written so that an AI coding agent (or a human) can work through it **one task per iteration**. Architecture, conventions and the non-negotiable rules are in [CLAUDE.md](CLAUDE.md); this file only says _what_ to build next.

## How to work on this roadmap

Each iteration:

1. **Pick** the first open task (`- [ ]`) whose dependencies are done. Tasks run in order. Don't skip ahead or bundle tasks. A task marked 🧭 needs a human decision: ask, record the answer in the decision log, then continue.
2. **Read** CLAUDE.md and the code the task touches. If the task is unclear or conflicts with CLAUDE.md, ask instead of guessing.
3. **Branch:** `roadmap/<task-id>-<slug>`, e.g. `roadmap/7.1-french-italian`.
4. **Implement** the task, including its tests. Stay within its scope. Add anything unrelated you notice to the [Inbox](#inbox) instead of fixing it now.
5. **Verify:** `composer check` and `npm --prefix frontend run verify` pass. For UI tasks, also run the browser and CSP check from CLAUDE.md → Definition of done.
6. **Document:** update `docs/api.md` for API changes, and CLAUDE.md if a convention or the architecture changed.
7. **Tick** the checkbox and append `— done YYYY-MM-DD`, plus one line the next task should know if there is something.
8. **Commit and open a PR** titled `<task-id>: <title>`, one task per PR. Merging to `main` deploys to production.

If a task grows beyond roughly 400 changed lines (not counting tests and lock files), first split it here into lettered subtasks (`7.1a`, `7.1b`, …), commit that split, then do the first subtask.

Every UI task: all text goes in both locale files; there are no CSP violations; the layout works at 360 px width and in light and dark mode; it's keyboard accessible.

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
| D10 | Legal texts live in `config.php` (server only) and are served by the API, so the operator's details stay out of the repository; the privacy policy is German only | 2026-10-19 |
| D11 | In text polls, yes **and** maybe count as a choice for the minimum and maximum; no and unanswered don't                            | 2026-10-20 |

Decisions still open are marked 🧭 on the tasks that need them: hidden responses (7.4), notifications (7.6).

## Tasks

- [ ] **7.1** French and Italian translations
- [ ] **7.2** Password-protected polls: the poll key is wrapped with a PBKDF2-derived key, so the link alone isn't enough
- [ ] **7.3** Sign-up sheet mode: a maximum number of participants per option
- [ ] **7.4** Hidden responses, where only the admin sees votes: responses encrypted to an admin public key (ECDH P-256 + AES-GCM) 🧭 needs a design review
- [ ] **7.5** Comments on polls
- [ ] **7.6** Notifications 🧭 this means storing e-mail addresses, a privacy trade-off; perhaps opt-in "someone voted" mails without content
- [ ] **7.7** Reproducible builds and a published hash of `index.html`, so users can verify the code they are served

## Inbox

Things noticed during other tasks, to be turned into tasks above:

- Rate limits count IPv6 clients per full address, so a client with a /64 prefix can switch addresses to get fresh limits. Consider counting IPv6 per /64 (the bucket would then cover the prefix, not the address).
- `composer check` fails locally (PHP 8.5.12, PHPStan 2.3.1) with one error in code that hasn't changed: `bin/migrate.php:18: Variable $argv might not be defined.` Read the arguments from `$_SERVER['argv']`, or check that CI sees the same error.
