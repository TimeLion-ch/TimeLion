import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { cspHash, inlineHashes, renderHtaccess } from './csp.mjs';

const sha = (/** @type {string} */ content) =>
	`'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`;

describe('inlineHashes', () => {
	it('hashes the exact content of inline scripts and styles', () => {
		const html =
			'<html><head><style rel="stylesheet">a{b:c}</style></head><body><script type="module">x()</script></body></html>';

		expect(inlineHashes(html)).toEqual({ scripts: [sha('x()')], styles: [sha('a{b:c}')] });
	});

	it('rejects external scripts', () => {
		expect(() => inlineHashes('<script>x()</script><script src="/a.js"></script>')).toThrow(/external script/);
	});

	it('rejects external stylesheets', () => {
		expect(() => inlineHashes('<script>x()</script><link rel="stylesheet" href="/a.css">')).toThrow(/stylesheet/);
	});

	it('requires at least one inline script', () => {
		expect(() => inlineHashes('<style>a{}</style>')).toThrow(/no inline script/);
	});
});

describe('renderHtaccess', () => {
	it('fills in the CSP placeholders', () => {
		const result = renderHtaccess('script-src {{CSP_SCRIPT_SRC}}; style-src {{CSP_STYLE_SRC}}', {
			scripts: ["'sha256-a'", "'sha256-b'"],
			styles: [],
		});

		expect(result).toBe("script-src 'sha256-a' 'sha256-b'; style-src 'none'");
	});

	it('fails when a placeholder is missing', () => {
		expect(() => renderHtaccess('script-src {{CSP_SCRIPT_SRC}}', { scripts: [cspHash('x')], styles: [] })).toThrow(
			/CSP_STYLE_SRC/,
		);
	});
});

describe('htaccess.template', () => {
	// A change to the policy must change this test too: scripts and styles only by hash, nothing from other origins.
	it('keeps the Content-Security-Policy hash-only and same-origin', async () => {
		const template = await readFile(new URL('../htaccess.template', import.meta.url), 'utf8');
		const policy = /Header always set Content-Security-Policy "([^"]+)"/.exec(template)?.[1] ?? '';
		const directives = Object.fromEntries(
			policy.split(';').map((directive) => {
				const [name, ...values] = directive.trim().split(/\s+/);
				return [name, values];
			}),
		);

		expect(directives).toEqual({
			'default-src': ["'none'"],
			'script-src': ['{{CSP_SCRIPT_SRC}}'],
			'style-src': ['{{CSP_STYLE_SRC}}'],
			'img-src': ["'self'", 'data:'],
			'connect-src': ["'self'"],
			'base-uri': ["'none'"],
			'form-action': ["'self'"],
			'frame-ancestors': ["'none'"],
		});
	});
});
