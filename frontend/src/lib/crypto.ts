/**
 * End-to-end encryption of poll documents and responses with WebCrypto (CLAUDE.md → Encryption design).
 *
 * One AES-GCM-256 key per poll. A ciphertext is the envelope `v1.{base64url(iv)}.{base64url(ciphertext‖tag)}` with a
 * fresh 12-byte IV per call, and the AAD `timelion:v1:{kind}` binds it to its kind, so a response can't be passed off
 * as a poll document. The plaintext is UTF-8 JSON; the caller validates what `decryptJson` returns (model.ts).
 */

import { decode, encode } from './base64url';

export type Kind = 'poll' | 'response';

/** The exported key: 32 bytes as 43 base64url characters. It travels only in the URL fragment and localStorage. */
export const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** The same check as the backend (docs/api.md → Formats and limits). */
export const ENVELOPE_PATTERN = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{24,}$/;

const algorithm = 'AES-GCM';

/** Thrown for every ciphertext that can't be opened: malformed, wrong key, wrong kind, tampered or not JSON. */
export class DecryptionError extends Error {
	constructor(message = 'The ciphertext could not be decrypted.') {
		super(message);
		this.name = 'DecryptionError';
	}
}

export function generatePollKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey({ name: algorithm, length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function exportKey(key: CryptoKey): Promise<string> {
	return encode(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
}

/**
 * The imported key is not extractable: whoever has the string already has the key.
 *
 * @throws TypeError (as a rejection) if `text` is not 43 canonical base64url characters
 */
export async function importKey(text: string): Promise<CryptoKey> {
	if (!KEY_PATTERN.test(text)) {
		throw new TypeError('A poll key is 43 base64url characters.');
	}
	return crypto.subtle.importKey('raw', decode(text), algorithm, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(key: CryptoKey, kind: Kind, value: unknown): Promise<string> {
	const json = JSON.stringify(value) as string | undefined;
	if (json === undefined) {
		throw new TypeError('The value has no JSON representation.');
	}
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: algorithm, iv, additionalData: aad(kind) },
		key,
		new TextEncoder().encode(json),
	);
	return `v1.${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
}

/**
 * @returns the parsed JSON, not yet validated: anyone with the link can write anything (CLAUDE.md, rule 7)
 * @throws DecryptionError
 */
export async function decryptJson(key: CryptoKey, kind: Kind, envelope: string): Promise<unknown> {
	if (!ENVELOPE_PATTERN.test(envelope)) {
		throw new DecryptionError('Not a v1 ciphertext envelope.');
	}
	const [, ivText = '', ciphertextText = ''] = envelope.split('.');
	let plaintext: ArrayBuffer;
	try {
		plaintext = await crypto.subtle.decrypt(
			{ name: algorithm, iv: decode(ivText), additionalData: aad(kind) },
			key,
			decode(ciphertextText),
		);
	} catch {
		throw new DecryptionError();
	}
	try {
		return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)) as unknown;
	} catch {
		throw new DecryptionError('The plaintext is not UTF-8 JSON.');
	}
}

function aad(kind: Kind): Uint8Array<ArrayBuffer> {
	return new TextEncoder().encode(`timelion:v1:${kind}`);
}
