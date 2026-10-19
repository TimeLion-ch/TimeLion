import { describe, expect, it } from 'vitest';
import { decryptJson, encryptJson, exportKey, generatePollKey, importKey } from './crypto';
import { adminLink, editLink, parseFragment, participantLink } from './links';

const origin = 'https://timelion.ch';
const id = '0123456789abcdef0123456789abcdef';
const responseId = 'fedcba9876543210fedcba9876543210';
const key = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const adminToken = 'a-_Zb'.repeat(8) + 'xyz';
const editToken = 'E'.repeat(43);

const hashOf = (link: string) => new URL(link).hash;

describe('links', () => {
	it('builds the participant link', () => {
		expect(participantLink(origin, id, key)).toBe(`${origin}/p/${id}#k=${key}`);
	});

	it('builds the admin link', () => {
		expect(adminLink(origin, id, key, adminToken)).toBe(`${origin}/p/${id}#k=${key}&a=${adminToken}`);
	});

	it('builds the personal edit link', () => {
		expect(editLink(origin, id, key, responseId, editToken)).toBe(
			`${origin}/p/${id}#k=${key}&r=${responseId}.${editToken}`,
		);
	});

	it('keeps the secrets out of the path and the query string', () => {
		const url = new URL(adminLink(origin, id, key, adminToken));

		expect(url.pathname).toBe(`/p/${id}`);
		expect(url.search).toBe('');
	});
});

describe('parseFragment', () => {
	it('round-trips every kind of link', () => {
		expect(parseFragment(hashOf(participantLink(origin, id, key)))).toEqual({ key });
		expect(parseFragment(hashOf(adminLink(origin, id, key, adminToken)))).toEqual({ key, adminToken });
		expect(parseFragment(hashOf(editLink(origin, id, key, responseId, editToken)))).toEqual({
			key,
			edit: { responseId, editToken },
		});
	});

	it('round-trips a generated key into a key that decrypts', async () => {
		const pollKey = await generatePollKey();
		const envelope = await encryptJson(pollKey, 'poll', { title: 'T' });

		const fragment = parseFragment(hashOf(participantLink(origin, id, await exportKey(pollKey))));

		expect(fragment).not.toBeNull();
		await expect(decryptJson(await importKey(fragment?.key ?? ''), 'poll', envelope)).resolves.toEqual({
			title: 'T',
		});
	});

	it('accepts a fragment without the leading #, and parameters in any order', () => {
		expect(parseFragment(`a=${adminToken}&k=${key}`)).toEqual({ key, adminToken });
	});

	it.each([
		['empty', ''],
		['only #', '#'],
		['garbage', '#%%%&&==?'],
		['a bare key without k=', `#${key}`],
		['an empty key', '#k='],
		['a key that is too short', `#k=${key.slice(0, -1)}`],
		['a key that is too long', `#k=${key}A`],
		['a key with a non-canonical last character', `#k=${key.slice(0, -1)}B`],
		['a key in standard base64', `#k=${key.slice(0, -2)}+8`],
		['a key with spaces', `#k=${key.slice(0, -1)} `],
		['an admin token without a key', `#a=${adminToken}`],
		['an edit part without a key', `#r=${responseId}.${editToken}`],
	])('returns null for %s', (_, hash) => {
		expect(parseFragment(hash)).toBeNull();
	});

	it.each([
		['a short admin token', `#k=${key}&a=${adminToken.slice(1)}`],
		['an empty admin token', `#k=${key}&a=`],
		['an edit part without a dot', `#k=${key}&r=${responseId}${editToken}`],
		['an edit part with an uppercase ID', `#k=${key}&r=${responseId.toUpperCase()}.${editToken}`],
		['an edit part with a short token', `#k=${key}&r=${responseId}.${editToken.slice(1)}`],
		['an edit part with trailing text', `#k=${key}&r=${responseId}.${editToken}.x`],
	])('keeps the key but leaves out %s', (_, hash) => {
		expect(parseFragment(hash)).toEqual({ key });
	});
});
