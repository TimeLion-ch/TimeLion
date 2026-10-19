import { describe, expect, it } from 'vitest';
import { decode, encode } from './base64url';

const bytes = (text: string) => new TextEncoder().encode(text);

/** btoa as an independent reference implementation. */
function reference(data: Uint8Array): string {
	return btoa(String.fromCharCode(...data))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

describe('encode', () => {
	it.each([
		['', ''],
		['f', 'Zg'],
		['fo', 'Zm8'],
		['foo', 'Zm9v'],
		['foob', 'Zm9vYg'],
		['fooba', 'Zm9vYmE'],
		['foobar', 'Zm9vYmFy'],
	])('encodes the RFC 4648 test vector %j without padding', (input, expected) => {
		expect(encode(bytes(input))).toBe(expected);
	});

	it('uses the URL-safe alphabet', () => {
		expect(encode(new Uint8Array([0xfb, 0xff]))).toBe('-_8');
	});

	it('matches btoa for random data of every length up to 100', () => {
		for (let length = 0; length <= 100; length++) {
			const data = crypto.getRandomValues(new Uint8Array(length));
			expect(encode(data)).toBe(reference(data));
		}
	});
});

describe('decode', () => {
	it('round-trips every byte value and every length up to 100', () => {
		const all = Uint8Array.from({ length: 256 }, (_, i) => i);
		expect(decode(encode(all))).toEqual(all);
		for (let length = 0; length <= 100; length++) {
			const data = crypto.getRandomValues(new Uint8Array(length));
			expect(decode(encode(data))).toEqual(data);
		}
	});

	it('returns 32 bytes for a 43-character key', () => {
		expect(decode('A'.repeat(43))).toHaveLength(32);
	});

	it.each([
		['padding', 'Zg=='],
		['whitespace', 'Zm 9v'],
		['a newline', 'Zm9v\n'],
		['standard base64 characters', 'ab+/'],
		['non-ASCII characters', 'Zm9vä'],
		['an impossible length', 'Zm9vY'],
		['set bits after the last byte', 'Zh'],
		['set bits after the last two bytes', 'Zm9'],
	])('rejects %s', (_, input) => {
		expect(() => decode(input)).toThrow(TypeError);
	});
});
