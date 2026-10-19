/**
 * Starts the app for the end-to-end tests (playwright.config.ts runs it): PHP's built-in server with dev/router.php,
 * which serves the built public/index.html with the CSP from public/.htaccess, and the API on a fresh SQLite database
 * (var/e2e.sqlite, see e2e/config.php). The development database is never touched.
 *
 *   node e2e/server.mjs <port>
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port <= 0) {
	throw new Error('Usage: node e2e/server.mjs <port>');
}

const root = new URL('../../', import.meta.url);
if (!existsSync(new URL('public/index.html', root))) {
	throw new Error('public/index.html is missing. Run `npm run build` first (`npm run e2e` does).');
}

const options = {
	cwd: fileURLToPath(root),
	env: { ...process.env, TIMELION_CONFIG: fileURLToPath(new URL('config.php', import.meta.url)) },
	stdio: /** @type {const} */ ('inherit'),
};

rmSync(new URL('var/e2e.sqlite', root), { force: true });
const migrate = spawnSync('php', ['bin/migrate.php'], options);
if (migrate.status !== 0) {
	process.exit(migrate.status ?? 1);
}

// -q: no line per request; PHP's errors still go to stderr.
const server = spawn('php', ['-q', '-S', `127.0.0.1:${port}`, '-t', 'public', 'dev/router.php'], options);
for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
	process.on(signal, () => server.kill(signal));
}
server.on('exit', (code) => process.exit(code ?? 0));
