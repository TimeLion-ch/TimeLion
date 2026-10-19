import { describe, expect, it } from 'vitest';
import { decode, encode } from './base64url';
import {
	DecryptionError,
	decryptJson,
	encryptJson,
	exportKey,
	generatePollKey,
	importKey,
	KEY_PATTERN,
} from './crypto';

/** Copied from src/Http/Validate.php (CIPHERTEXT_PATTERN), so a change on either side shows up here. */
const backendPattern = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{24,}$/;

const poll = { v: 1, title: 'Grillabend 🦁', options: [{ id: '0a1b2c3d', start: '2026-11-03' }] };

/** Replaces the character at `index` with a different base64url character. */
function flip(text: string, index: number): string {
	const replacement = text[index] === 'A' ? 'B' : 'A';
	return text.slice(0, index) + replacement + text.slice(index + 1);
}

function decodeOrNull(text: string): Uint8Array | null {
	try {
		return decode(text);
	} catch {
		return null;
	}
}

/** Encrypts raw bytes the way encryptJson does, to test what decryptJson does with plaintext that isn't JSON. */
async function encryptBytes(key: CryptoKey, plaintext: Uint8Array<ArrayBuffer>): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const additionalData = new TextEncoder().encode('timelion:v1:poll');
	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, plaintext);
	return `v1.${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
}

describe('keys', () => {
	it('exports a 256-bit key as 43 base64url characters', async () => {
		const exported = await exportKey(await generatePollKey());

		expect(exported).toMatch(KEY_PATTERN);
	});

	it('accepts exactly the canonical 43-character encodings as KEY_PATTERN', () => {
		for (const last of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_') {
			const text = 'A'.repeat(42) + last;
			expect(KEY_PATTERN.test(text), text).toBe(decodeOrNull(text) !== null);
		}
	});

	it('generates a different key every time', async () => {
		const [a, b] = await Promise.all([generatePollKey(), generatePollKey()]);

		expect(await exportKey(a)).not.toBe(await exportKey(b));
	});

	it('imports an exported key that decrypts what the original encrypted', async () => {
		const key = await generatePollKey();
		const envelope = await encryptJson(key, 'poll', poll);

		const imported = await importKey(await exportKey(key));

		await expect(decryptJson(imported, 'poll', envelope)).resolves.toEqual(poll);
		expect(imported.extractable).toBe(false);
	});

	it.each([
		['empty', ''],
		['too short', 'A'.repeat(42)],
		['too long', 'A'.repeat(44)],
		['padded', 'A'.repeat(42) + '='],
		['standard base64', 'A'.repeat(42) + '+'],
		['non-canonical', 'A'.repeat(42) + 'B'],
	])('rejects a key that is %s', async (_, text) => {
		await expect(importKey(text)).rejects.toThrow(TypeError);
	});
});

describe('encryptJson and decryptJson', () => {
	it('round-trips JSON values, including non-ASCII text', async () => {
		const key = await generatePollKey();

		for (const value of [poll, { name: 'Zoë', comment: 'Grüezi 👋' }, [1, 'two', null], {}]) {
			await expect(decryptJson(key, 'response', await encryptJson(key, 'response', value))).resolves.toEqual(
				value,
			);
		}
	});

	it('produces envelopes the backend accepts, even for the smallest object', async () => {
		const key = await generatePollKey();

		expect(await encryptJson(key, 'poll', poll)).toMatch(backendPattern);
		expect(await encryptJson(key, 'poll', {})).toMatch(backendPattern);
	});

	it('uses a fresh IV for every call', async () => {
		const key = await generatePollKey();
		const envelopes = await Promise.all(Array.from({ length: 20 }, () => encryptJson(key, 'poll', poll)));
		const ivs = envelopes.map((envelope) => envelope.split('.')[1]);

		expect(new Set(ivs).size).toBe(20);
		expect(new Set(envelopes).size).toBe(20);
	});

	it('rejects values without a JSON representation', async () => {
		const key = await generatePollKey();

		await expect(encryptJson(key, 'poll', undefined)).rejects.toThrow(TypeError);
	});

	it('fails with the wrong key', async () => {
		const envelope = await encryptJson(await generatePollKey(), 'poll', poll);

		await expect(decryptJson(await generatePollKey(), 'poll', envelope)).rejects.toThrow(DecryptionError);
	});

	it('fails with the wrong kind', async () => {
		const key = await generatePollKey();
		const envelope = await encryptJson(key, 'response', poll);

		await expect(decryptJson(key, 'poll', envelope)).rejects.toThrow(DecryptionError);
	});

	it('fails when any part of the ciphertext is tampered with', async () => {
		const key = await generatePollKey();
		const envelope = await encryptJson(key, 'poll', poll);
		const [, iv = '', ciphertext = ''] = envelope.split('.');

		const tampered = [
			`v1.${flip(iv, 0)}.${ciphertext}`,
			`v1.${iv}.${flip(ciphertext, 0)}`,
			`v1.${iv}.${flip(ciphertext, ciphertext.length - 10)}`,
			`v1.${iv}.${ciphertext.slice(0, -4)}`,
			`v1.${iv}.${ciphertext}AAAA`,
		];
		for (const candidate of tampered) {
			await expect(decryptJson(key, 'poll', candidate), candidate).rejects.toThrow(DecryptionError);
		}
	});

	it.each([
		['empty', ''],
		['another version', 'v2.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAA'],
		['a short IV', 'v1.AAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAA'],
		['a short ciphertext', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAA'],
		['an extra part', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAA.AAAA'],
		['a trailing newline', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAA\n'],
	])('rejects an envelope that is %s', async (_, envelope) => {
		await expect(decryptJson(await generatePollKey(), 'poll', envelope)).rejects.toThrow(DecryptionError);
	});

	it('fails when the plaintext is not UTF-8 JSON', async () => {
		const key = await generatePollKey();

		const notJson = await encryptBytes(key, new TextEncoder().encode('not json'));
		const notUtf8 = await encryptBytes(key, new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]));

		await expect(decryptJson(key, 'poll', notJson)).rejects.toThrow(DecryptionError);
		await expect(decryptJson(key, 'poll', notUtf8)).rejects.toThrow(DecryptionError);
	});
});
