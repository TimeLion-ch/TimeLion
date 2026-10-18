import { createHash } from 'node:crypto';
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
