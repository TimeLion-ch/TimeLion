/**
 * base64url without padding (RFC 4648 §5), in plain TypeScript: `Buffer` doesn't exist in the browser, and
 * `btoa`/`atob` work on binary strings and accept padding and whitespace.
 */

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const values = new Map<string, number>([...alphabet].map((char, index) => [char, index]));

export function encode(bytes: Uint8Array): string {
	let out = '';
	let i = 0;
	for (; i + 2 < bytes.length; i += 3) {
		const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
		out += alphabet[n >> 18]! + alphabet[(n >> 12) & 63]! + alphabet[(n >> 6) & 63]! + alphabet[n & 63]!;
	}
	const rest = bytes.length - i;
	if (rest === 1) {
		const n = bytes[i]! << 16;
		out += alphabet[n >> 18]! + alphabet[(n >> 12) & 63]!;
	} else if (rest === 2) {
		const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
		out += alphabet[n >> 18]! + alphabet[(n >> 12) & 63]! + alphabet[(n >> 6) & 63]!;
	}
	return out;
}

/**
 * Strict: padding, whitespace, characters outside the alphabet, an impossible length (4n + 1) and set bits after
 * the last byte all throw, so every byte sequence has exactly one accepted encoding.
 *
 * @throws TypeError if `text` is not canonical base64url
 */
export function decode(text: string): Uint8Array<ArrayBuffer> {
	if (text.length % 4 === 1) {
		throw new TypeError('Invalid base64url length.');
	}
	const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
	let buffer = 0;
	let bits = 0;
	let j = 0;
	for (const char of text) {
		const value = values.get(char);
		if (value === undefined) {
			throw new TypeError('Invalid base64url character.');
		}
		buffer = ((buffer << 6) | value) & 0xffff;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			bytes[j++] = buffer >> bits;
			buffer &= (1 << bits) - 1;
		}
	}
	if (buffer !== 0) {
		throw new TypeError('Non-canonical base64url: unused bits are set.');
	}
	return bytes;
}
