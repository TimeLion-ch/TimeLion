![TimeLion Logo](docs/logo_sm.png)

# TimeLion

TimeLion is a simple, open-source, privacy-focused meeting scheduler. It is **end-to-end encrypted**: polls are encrypted in your browser, and the server only ever stores ciphertext. Use it for free on [timelion.ch](https://timelion.ch) or host it yourself.

> **Status:** being rebuilt. The new foundation (Slim API plus a single-file Svelte frontend) is in place. The scheduling features follow the [roadmap](roadmap.md).

## How it works

- Creating a poll generates a random key in your browser. The key is part of the link after the `#`, a part browsers never send to servers.
- Titles, options, names and votes are encrypted with that key before upload. Everyone with the link can read and answer the poll; the server can't.
- No accounts, no cookies, no tracking, no third-party resources. Every poll expires and is then deleted.

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
cp config.example.php config.php                              # then fill in database and secret
php bin/migrate.php
```

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

Checks: `composer check` (PHP) and `npm --prefix frontend run verify` (frontend).

The architecture, conventions and rules for contributors (human or AI) are in [CLAUDE.md](CLAUDE.md).

## License

[GPL-3.0](LICENSE)
