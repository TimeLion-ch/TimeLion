![TimeLion Logo](docs/logo_sm.png)

# TimeLion

TimeLion is a simple, open-source, privacy-focused meeting scheduler. Participants vote on dates and times, or on text options of the creator's choosing (places, dishes, …), optionally with a minimum and a maximum of choices each. It is **end-to-end encrypted**: polls are encrypted in your browser, and the server only ever stores ciphertext. Use it for free on [timelion.ch](https://timelion.ch) or host it yourself.

> **Status:** being rebuilt. Polls can be created, answered and managed again, end-to-end tests run in CI, and a security review is done; the legal pages and the first production deploy come next (see the [roadmap](roadmap.md)).

## How it works

- Creating a poll generates a random key in your browser. The key is part of the link after the `#`, a part browsers never send to servers.
- Titles, options, names and votes are encrypted with that key before upload. Everyone with the link can read and answer the poll; the server can't.
- No accounts, no cookies, no tracking, no third-party resources. Every poll expires and is then deleted.
- Because the server never sees votes, it can't enforce the choice limits of text polls: the voting form checks them, but a modified browser could ignore them.

## Self-hosting

Requirements:

- PHP 8.3+ with `pdo_mysql` (or `pdo_sqlite`)
- MySQL/MariaDB, or SQLite for small installations
- Apache with `mod_rewrite` and `mod_headers` (the app ships an `.htaccess`), served over HTTPS
- For building: Composer and Node.js 24

Steps:

```bash
composer install --no-dev --optimize-autoloader
npm --prefix frontend ci && npm --prefix frontend run build   # writes public/index.html and public/.htaccess
cp config.example.php config.php                              # then fill in database, secret and privacy policy
php bin/migrate.php
```

Expired polls are deleted automatically after about 2% of API requests. If your host offers cron, you can also run the purge on a schedule, for example hourly:

```bash
php bin/purge.php
```

`public/.well-known/security.txt` names the TimeLion project as the security contact. On your own instance, replace it with your contact, or delete it.

Point the document root at `public/` if your host allows it. If the document root has to stay the app root, the `.htaccess` there rewrites every request into `public/`. Either way, nothing outside `public/` may be reachable from the web.

Automated deployment with GitHub Actions (FTP with TLS, for webspaces without SSH) is described in [CLAUDE.md → Deployment](CLAUDE.md#deployment).

## Development

```bash
composer install
npm --prefix frontend ci
cp config.example.php config.php    # set 'env' => 'dev' and a secret of at least 32 characters
php bin/migrate.php
npm --prefix frontend run build
composer serve                      # http://localhost:8000
```

For frontend work with hot reload, run `npm --prefix frontend run dev` (http://localhost:5173) alongside `composer serve`.

Checks: `composer check` (PHP), `npm --prefix frontend run verify` (frontend) and `npm --prefix frontend run e2e` (end-to-end tests with Playwright; install its browser once with `npx --prefix frontend playwright install chromium`).

The architecture, conventions and rules for contributors (human or AI) are in [CLAUDE.md](CLAUDE.md).

## License

[AGPL-3.0](LICENSE). If you run a modified version of TimeLion for others, the AGPL asks you to offer its users the source code of your version (section 13): point the "Source code" link in the footer (`frontend/src/components/SiteFooter.svelte`) to it.

The lion logo is ["Lion" from SVG Repo](https://www.svgrepo.com/svg/484717/lion), which is in the public domain ([SVG Repo's PD license](https://www.svgrepo.com/page/licensing/)). The font, [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans), is licensed under the [SIL Open Font License 1.1](frontend/src/assets/fonts/OFL.txt).
