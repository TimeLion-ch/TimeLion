import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, serverLimits, type StoredPoll } from './api';
import { encryptJson, generatePollKey, importKey } from './crypto';
import { parsePoll, parseResponse, type Poll, type PollResponse, type TextPoll } from './model';
import {
	closePoll,
	createPoll,
	deletePoll,
	deleteResponse,
	editResponse,
	loadPoll,
	reopenPoll,
	submitResponse,
	UnreadablePollError,
	updatePoll,
} from './polls';

const poll: Poll = {
	v: 1,
	type: 'dates',
	title: 'Grillabend',
	description: 'Bring etwas zum Grillieren mit.',
	timezone: 'Europe/Zurich',
	options: [
		{ id: '0a1b2c3d', start: '2026-11-03' },
		{ id: '1a2b3c4d', start: '2026-11-04T18:00', end: '2026-11-04T22:00' },
	],
	allowMaybe: true,
};

const zoe: PollResponse = { v: 1, name: 'Zoë', votes: { '0a1b2c3d': 'yes', '1a2b3c4d': 'maybe' } };
const max: PollResponse = { v: 1, name: 'Max', votes: { '0a1b2c3d': 'no' }, comment: 'Leider nicht' };

const notFound = () => new ApiError(404, 'not_found', 'Not found.');

/**
 * An in-memory stand-in for the API (docs/api.md): it stores what the client sends, generates IDs and tokens, checks
 * tokens and the closed state, and never sees a key.
 */
class FakeServer {
	readonly polls = new Map<string, StoredPoll & { adminToken: string }>();
	readonly editTokens = new Map<string, string>();
	now = 1_800_000_000;
	private counter = 0;

	constructor() {
		vi.spyOn(api, 'createPoll').mockImplementation(async (ciphertext, expiresAt) => {
			const id = this.id();
			const adminToken = this.token();
			const { now } = this;
			this.polls.set(id, {
				id,
				ciphertext,
				createdAt: now,
				updatedAt: now,
				expiresAt,
				closedAt: null,
				responses: [],
				adminToken,
			});
			return { id, adminToken, createdAt: now, expiresAt };
		});
		vi.spyOn(api, 'getPoll').mockImplementation(async (id) => {
			const { adminToken: _, ...stored } = this.poll(id);
			return structuredClone(stored);
		});
		vi.spyOn(api, 'updatePoll').mockImplementation(async (id, adminToken, patch) => {
			const stored = this.admin(id, adminToken);
			if (patch.ciphertext !== undefined) {
				stored.ciphertext = patch.ciphertext;
			}
			if (patch.expiresAt !== undefined) {
				stored.expiresAt = patch.expiresAt;
			}
			if (patch.closed !== undefined) {
				stored.closedAt = patch.closed ? (stored.closedAt ?? this.now) : null;
			}
			stored.updatedAt = this.now;
			return { id, updatedAt: stored.updatedAt, expiresAt: stored.expiresAt, closedAt: stored.closedAt };
		});
		vi.spyOn(api, 'deletePoll').mockImplementation(async (id, adminToken) => {
			this.admin(id, adminToken);
			this.polls.delete(id);
		});
		vi.spyOn(api, 'createResponse').mockImplementation(async (pollId, ciphertext) => {
			const stored = this.open(pollId);
			const id = this.id();
			const editToken = this.token();
			stored.responses.push({ id, ciphertext, createdAt: this.now, updatedAt: this.now });
			this.editTokens.set(id, editToken);
			return { id, editToken, createdAt: this.now };
		});
		vi.spyOn(api, 'updateResponse').mockImplementation(async (pollId, responseId, editToken, ciphertext) => {
			const response = this.response(this.open(pollId), responseId);
			if (this.editTokens.get(responseId) !== editToken) {
				throw new ApiError(403, 'forbidden', 'Forbidden.');
			}
			response.ciphertext = ciphertext;
			response.updatedAt = this.now;
			return { id: responseId, updatedAt: this.now };
		});
		vi.spyOn(api, 'deleteResponse').mockImplementation(async (pollId, responseId, token) => {
			const stored = this.poll(pollId);
			this.response(stored, responseId);
			if (token !== stored.adminToken && token !== this.editTokens.get(responseId)) {
				throw new ApiError(403, 'forbidden', 'Forbidden.');
			}
			stored.responses = stored.responses.filter((response) => response.id !== responseId);
		});
	}

	/** Everything the server holds, as one string, to check that no plaintext reached it. */
	dump(): string {
		return JSON.stringify([...this.polls.values()]);
	}

	/** Stores a response directly, bypassing the client. */
	inject(pollId: string, ciphertext: string): string {
		const id = this.id();
		this.poll(pollId).responses.push({ id, ciphertext, createdAt: this.now, updatedAt: this.now });
		return id;
	}

	private poll(id: string) {
		const stored = this.polls.get(id);
		if (stored === undefined) {
			throw notFound();
		}
		return stored;
	}

	private admin(id: string, adminToken: string) {
		const stored = this.poll(id);
		if (stored.adminToken !== adminToken) {
			throw new ApiError(403, 'forbidden', 'Forbidden.');
		}
		return stored;
	}

	private open(id: string) {
		const stored = this.poll(id);
		if (stored.closedAt !== null) {
			throw new ApiError(409, 'poll_closed', 'This poll is closed.');
		}
		return stored;
	}

	private response(stored: StoredPoll, responseId: string) {
		const response = stored.responses.find((candidate) => candidate.id === responseId);
		if (response === undefined) {
			throw notFound();
		}
		return response;
	}

	private id(): string {
		return (++this.counter).toString(16).padStart(32, '0');
	}

	private token(): string {
		return (++this.counter).toString().padStart(43, 'T');
	}
}

let server: FakeServer;

beforeEach(() => {
	server = new FakeServer();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('createPoll and loadPoll', () => {
	it('encrypts the poll, stores only ciphertext and decrypts it again', async () => {
		const { id, key, adminToken } = await createPoll(poll, server.now + 86400);

		expect(server.dump()).not.toContain('Grillabend');
		expect(server.dump()).not.toContain(key);
		expect(server.polls.get(id)?.adminToken).toBe(adminToken);

		await expect(loadPoll(id, key)).resolves.toEqual({
			poll,
			responses: [],
			skippedResponses: [],
			meta: {
				id,
				createdAt: server.now,
				updatedAt: server.now,
				expiresAt: server.now + 86400,
				closedAt: null,
			},
		});
	});

	it('uses a new key for every poll', async () => {
		const a = await createPoll(poll, server.now + 1);
		const b = await createPoll(poll, server.now + 1);

		expect(a.key).not.toBe(b.key);
		await expect(loadPoll(a.id, b.key)).rejects.toThrow(UnreadablePollError);
	});

	it('normalizes the poll before encrypting it', async () => {
		const { id, key } = await createPoll({ ...poll, finalOptionId: 'ffffffff', extra: 1 } as Poll, server.now + 1);

		expect((await loadPoll(id, key)).poll).toEqual(poll);
	});

	it('rejects an invalid poll without sending anything', async () => {
		await expect(createPoll({ ...poll, title: '' }, server.now + 1)).rejects.toThrow(TypeError);
		expect(api.createPoll).not.toHaveBeenCalled();
	});

	it('fails with UnreadablePollError for a wrong or malformed key', async () => {
		const { id } = await createPoll(poll, server.now + 1);
		const otherKey = (await createPoll(poll, server.now + 1)).key;

		await expect(loadPoll(id, otherKey)).rejects.toThrow(UnreadablePollError);
		await expect(loadPoll(id, 'not-a-key')).rejects.toThrow(UnreadablePollError);
	});

	it('does not request the poll when the key is malformed', async () => {
		await expect(loadPoll('0'.repeat(32), 'x')).rejects.toThrow(UnreadablePollError);
		expect(api.getPoll).not.toHaveBeenCalled();
	});

	it('fails with UnreadablePollError when the poll decrypts to an invalid document', async () => {
		const { id, key } = await createPoll(poll, server.now + 1);
		const stored = server.polls.get(id);
		if (stored !== undefined) {
			stored.ciphertext = await encryptJson(await importKey(key), 'poll', { v: 1, title: 'no options' });
		}

		await expect(loadPoll(id, key)).rejects.toThrow(UnreadablePollError);
	});

	it('fails with UnreadablePollError when a response is passed off as the poll', async () => {
		const { id, key } = await createPoll(poll, server.now + 1);
		const stored = server.polls.get(id);
		if (stored !== undefined) {
			stored.ciphertext = await encryptJson(await importKey(key), 'response', poll);
		}

		await expect(loadPoll(id, key)).rejects.toThrow(UnreadablePollError);
	});

	it('passes API errors through', async () => {
		const { key } = await createPoll(poll, server.now + 1);

		await expect(loadPoll('f'.repeat(32), key)).rejects.toEqual(notFound());
	});
});

describe('responses', () => {
	it('submits, loads, edits and deletes responses', async () => {
		const { id, key, adminToken } = await createPoll(poll, server.now + 1);
		const first = await submitResponse(id, key, poll, zoe);
		server.now += 10;
		const second = await submitResponse(id, key, poll, max);

		expect(server.dump()).not.toContain('Zoë');
		expect(server.dump()).not.toContain('Leider');

		let loaded = await loadPoll(id, key);
		expect(loaded.responses).toEqual([
			{ id: first.id, createdAt: first.createdAt, updatedAt: first.createdAt, response: zoe },
			{ id: second.id, createdAt: second.createdAt, updatedAt: second.createdAt, response: max },
		]);

		server.now += 10;
		const changed: PollResponse = { ...zoe, votes: { '0a1b2c3d': 'no' }, comment: 'Doch nicht' };
		await expect(editResponse(id, key, poll, first.id, first.editToken, changed)).resolves.toEqual({
			id: first.id,
			updatedAt: server.now,
		});
		loaded = await loadPoll(id, key);
		expect(loaded.responses[0]).toEqual({
			id: first.id,
			createdAt: first.createdAt,
			updatedAt: server.now,
			response: changed,
		});

		await deleteResponse(id, first.id, first.editToken);
		await deleteResponse(id, second.id, adminToken);
		expect((await loadPoll(id, key)).responses).toEqual([]);
	});

	it('drops votes for unknown options before encrypting', async () => {
		const { id, key } = await createPoll(poll, server.now + 1);

		await submitResponse(id, key, poll, { ...zoe, votes: { ...zoe.votes, ffffffff: 'yes' } });

		expect((await loadPoll(id, key)).responses[0]?.response).toEqual(zoe);
	});

	it('rejects an invalid response without sending anything', async () => {
		const { id, key, adminToken } = await createPoll(poll, server.now + 1);
		const created = await submitResponse(id, key, poll, zoe);

		await expect(submitResponse(id, key, poll, { ...zoe, name: ' ' })).rejects.toThrow(TypeError);
		await expect(editResponse(id, key, poll, created.id, adminToken, { ...zoe, name: '' })).rejects.toThrow(
			TypeError,
		);
		expect(api.createResponse).toHaveBeenCalledTimes(1);
		expect(api.updateResponse).not.toHaveBeenCalled();
	});

	it('refuses a response that breaks the choice limits, without sending anything', async () => {
		const lunch: TextPoll = {
			v: 1,
			type: 'text',
			title: 'Mittagessen',
			timezone: 'Europe/Zurich',
			options: [
				{ id: 'aaaaaaaa', text: 'Pizza' },
				{ id: 'bbbbbbbb', text: 'Sushi' },
				{ id: 'cccccccc', text: 'Curry' },
			],
			allowMaybe: true,
			minChoices: 1,
			maxChoices: 2,
		};
		const { id, key, adminToken } = await createPoll(lunch, server.now + 1);
		const fits: PollResponse = { v: 1, name: 'Zoë', votes: { aaaaaaaa: 'yes', bbbbbbbb: 'maybe', cccccccc: 'no' } };
		const created = await submitResponse(id, key, lunch, fits);

		const tooMany: PollResponse = { ...fits, votes: { ...fits.votes, cccccccc: 'maybe' } };
		const tooFew: PollResponse = { ...fits, votes: { aaaaaaaa: 'no' } };
		await expect(submitResponse(id, key, lunch, tooMany)).rejects.toThrow(TypeError);
		await expect(editResponse(id, key, lunch, created.id, created.editToken, tooFew)).rejects.toThrow(TypeError);
		expect(api.createResponse).toHaveBeenCalledTimes(1);
		expect(api.updateResponse).not.toHaveBeenCalled();

		// After the admin lowers the maximum, the response no longer fits, but it stays readable.
		await updatePoll(id, key, adminToken, { ...lunch, maxChoices: 1 });
		expect((await loadPoll(id, key)).responses.map((entry) => entry.response)).toEqual([fits]);
	});

	it('skips responses that cannot be read, and lists them', async () => {
		const { id, key } = await createPoll(poll, server.now + 1);
		const pollKey = await importKey(key);
		const good = await submitResponse(id, key, poll, zoe);
		const wrongKey = server.inject(id, await encryptJson(await generatePollKey(), 'response', zoe));
		const wrongKind = server.inject(id, await encryptJson(pollKey, 'poll', zoe));
		const invalid = server.inject(id, await encryptJson(pollKey, 'response', { v: 1, name: 'No votes' }));
		const garbage = server.inject(id, 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAA');

		const loaded = await loadPoll(id, key);

		expect(loaded.responses.map((response) => response.id)).toEqual([good.id]);
		expect(loaded.skippedResponses).toEqual([wrongKey, wrongKind, invalid, garbage]);
	});

	it('keeps API errors for closed polls and wrong tokens', async () => {
		const { id, key, adminToken } = await createPoll(poll, server.now + 1);
		const created = await submitResponse(id, key, poll, zoe);

		await expect(editResponse(id, key, poll, created.id, adminToken, zoe)).rejects.toMatchObject({ status: 403 });
		await closePoll(id, adminToken);
		await expect(submitResponse(id, key, poll, max)).rejects.toMatchObject({ code: 'poll_closed' });
	});
});

describe('admin', () => {
	it('replaces the poll document and the expiry', async () => {
		const { id, key, adminToken } = await createPoll(poll, server.now + 1);
		server.now += 5;
		const changed: Poll = { ...poll, title: 'Grillabend (verschoben)', finalOptionId: '1a2b3c4d' };

		await expect(updatePoll(id, key, adminToken, changed, server.now + 100)).resolves.toEqual({
			id,
			updatedAt: server.now,
			expiresAt: server.now + 100,
			closedAt: null,
		});

		const loaded = await loadPoll(id, key);
		expect(loaded.poll).toEqual(changed);
		expect(loaded.meta.expiresAt).toBe(server.now + 100);
		expect(server.dump()).not.toContain('verschoben');
	});

	it('keeps the expiry when none is given', async () => {
		const { id, key, adminToken } = await createPoll(poll, server.now + 1);

		await updatePoll(id, key, adminToken, poll);

		expect(api.updatePoll).toHaveBeenCalledWith(id, adminToken, { ciphertext: expect.any(String) });
	});

	it('closes and reopens the poll', async () => {
		const { id, key, adminToken } = await createPoll(poll, server.now + 1);

		await expect(closePoll(id, adminToken)).resolves.toMatchObject({ closedAt: server.now });
		expect((await loadPoll(id, key)).meta.closedAt).toBe(server.now);
		await expect(reopenPoll(id, adminToken)).resolves.toMatchObject({ closedAt: null });
		expect((await loadPoll(id, key)).meta.closedAt).toBeNull();
	});

	it('deletes the poll', async () => {
		const { id, key, adminToken } = await createPoll(poll, server.now + 1);

		await deletePoll(id, adminToken);

		await expect(loadPoll(id, key)).rejects.toEqual(notFound());
	});
});

describe('sizes', () => {
	it('keeps the largest valid documents within the server limits', async () => {
		const pollKey = await generatePollKey();
		// A control character is one code unit, but six bytes as JSON (\u0001): the most a code unit can cost.
		const worst = (length: number) => '\u0001'.repeat(length);
		const largestPoll: Poll = {
			v: 1,
			type: 'dates',
			title: worst(200),
			description: worst(2000),
			location: worst(200),
			timezone: 'America/Argentina/Buenos_Aires',
			options: Array.from({ length: 100 }, (_, i) => ({
				id: i.toString(16).padStart(8, '0'),
				start: '2026-11-03T18:00',
				end: '2026-11-03T22:00',
			})),
			allowMaybe: true,
			finalOptionId: '00000063',
		};
		const largestResponse: PollResponse = {
			v: 1,
			name: worst(80),
			votes: Object.fromEntries(largestPoll.options.map((option) => [option.id, 'maybe'])),
			comment: worst(500),
		};

		expect(parsePoll(largestPoll)).toEqual(largestPoll);
		expect(parseResponse(largestResponse, largestPoll)).toEqual(largestResponse);

		const pollCiphertext = await encryptJson(pollKey, 'poll', largestPoll);
		const responseCiphertext = await encryptJson(pollKey, 'response', largestResponse);

		expect(pollCiphertext.length).toBeLessThanOrEqual(serverLimits.pollCiphertextBytes);
		expect(responseCiphertext.length).toBeLessThanOrEqual(serverLimits.responseCiphertextBytes);
	});

	it('keeps the largest valid text poll within the server limit', async () => {
		const worst = (length: number) => '\u0001'.repeat(length);
		// Option texts can't contain control characters, so a code unit costs at most 3 bytes (e.g. €) as JSON.
		const largestPoll: TextPoll = {
			v: 1,
			type: 'text',
			title: worst(200),
			description: worst(2000),
			location: worst(200),
			timezone: 'America/Argentina/Buenos_Aires',
			options: Array.from({ length: 100 }, (_, i) => ({
				id: i.toString(16).padStart(8, '0'),
				text: '€'.repeat(100),
			})),
			allowMaybe: true,
			finalOptionId: '00000063',
			minChoices: 100,
			maxChoices: 100,
		};

		expect(parsePoll(largestPoll)).toEqual(largestPoll);
		const ciphertext = await encryptJson(await generatePollKey(), 'poll', largestPoll);
		expect(ciphertext.length).toBeLessThanOrEqual(serverLimits.pollCiphertextBytes);
	});
});
