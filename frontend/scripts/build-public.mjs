/**
 * Runs after `vite build`: copies the single-file app to public/index.html and generates
 * public/.htaccess with a Content-Security-Policy that allows exactly the inlined script and styles.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { inlineHashes, renderHtaccess } from './csp.mjs';

const frontend = new URL('../', import.meta.url);
const publicDir = new URL('../public/', frontend);

const html = await readFile(new URL('dist/index.html', frontend), 'utf8');
const template = await readFile(new URL('htaccess.template', frontend), 'utf8');

const hashes = inlineHashes(html);
await writeFile(new URL('index.html', publicDir), html);
await writeFile(new URL('.htaccess', publicDir), renderHtaccess(template, hashes));

console.log(
	`public/index.html (${(html.length / 1024).toFixed(1)} KiB) and public/.htaccess written ` +
		`(${hashes.scripts.length} script hash(es), ${hashes.styles.length} style hash(es)).`,
);
