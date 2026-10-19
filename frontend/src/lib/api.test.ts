import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, request } from './api';

function respond(status: number, body: unknown) {
	const fetchMock = vi.fn(async () => new Response(body === null ? null : JSON.stringify(body), { status }));
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('request', () => {
	it('returns the parsed JSON body', async () => {
		respond(200, { status: 'ok' });

		await expect(api.health()).resolves.toEqual({ status: 'ok' });
	});

	it('sends JSON bodies and bearer tokens, never cookies', async () => {
		const fetchMock = respond(201, { id: 'x' });

		await request('POST', '/things', { body: { a: 1 }, token: 'secret' });

		expect(fetchMock).toHaveBeenCalledWith('/api/things', {
			method: 'POST',
			headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer secret' },
			body: '{"a":1}',
			cache: 'no-store',
			credentials: 'omit',
			referrerPolicy: 'no-referrer',
		});
	});

	it('maps API errors to ApiError', async () => {
		respond(409, { error: { code: 'poll_closed', message: 'This poll is closed.' } });

		await expect(request('POST', '/x')).rejects.toEqual(new ApiError(409, 'poll_closed', 'This poll is closed.'));
	});

	it('handles error responses without an error body', async () => {
		respond(502, null);

		await expect(request('GET', '/x')).rejects.toMatchObject({ status: 502, code: 'http_error' });
	});

	it('reports network failures', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('Failed to fetch');
			}),
		);

		await expect(request('GET', '/x')).rejects.toMatchObject({ status: 0, code: 'network_error' });
	});

	it('returns null for 204 No Content', async () => {
		respond(204, null);

		await expect(request('DELETE', '/x')).resolves.toBeNull();
	});
});

describe('poll endpoints', () => {
	const pollId = '0123456789abcdef0123456789abcdef';
	const responseId = 'fedcba9876543210fedcba9876543210';
	const token = 'T'.repeat(43);
	const ciphertext = 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAA';

	/** The method, URL, Authorization header and parsed body of the only fetch call. */
	function sent(fetchMock: ReturnType<typeof respond>) {
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		const headers = init.headers as Record<string, string>;
		return {
			method: init.method,
			url,
			authorization: headers['Authorization'],
			body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : init.body,
		};
	}

	it('createPoll posts the ciphertext and expiry without a token', async () => {
		const created = { id: pollId, adminToken: token, createdAt: 1, expiresAt: 2 };
		const fetchMock = respond(201, created);

		await expect(api.createPoll(ciphertext, 2)).resolves.toEqual(created);
		expect(sent(fetchMock)).toEqual({
			method: 'POST',
			url: '/api/polls',
			authorization: undefined,
			body: { ciphertext, expiresAt: 2 },
		});
	});

	it('getPoll reads the poll with its responses', async () => {
		const stored = {
			id: pollId,
			ciphertext,
			createdAt: 1,
			updatedAt: 1,
			expiresAt: 2,
			closedAt: null,
			responses: [{ id: responseId, ciphertext, createdAt: 1, updatedAt: 1 }],
		};
		const fetchMock = respond(200, stored);

		await expect(api.getPoll(pollId)).resolves.toEqual(stored);
		expect(sent(fetchMock)).toEqual({
			method: 'GET',
			url: `/api/polls/${pollId}`,
			authorization: undefined,
			body: null,
		});
	});

	it('updatePoll patches with the admin token', async () => {
		const updated = { id: pollId, updatedAt: 3, expiresAt: 2, closedAt: 3 };
		const fetchMock = respond(200, updated);

		await expect(api.updatePoll(pollId, token, { closed: true })).resolves.toEqual(updated);
		expect(sent(fetchMock)).toEqual({
			method: 'PATCH',
			url: `/api/polls/${pollId}`,
			authorization: `Bearer ${token}`,
			body: { closed: true },
		});
	});

	it('deletePoll deletes with the admin token', async () => {
		const fetchMock = respond(204, null);

		await expect(api.deletePoll(pollId, token)).resolves.toBeUndefined();
		expect(sent(fetchMock)).toEqual({
			method: 'DELETE',
			url: `/api/polls/${pollId}`,
			authorization: `Bearer ${token}`,
			body: null,
		});
	});

	it('createResponse posts the ciphertext without a token', async () => {
		const created = { id: responseId, editToken: token, createdAt: 1 };
		const fetchMock = respond(201, created);

		await expect(api.createResponse(pollId, ciphertext)).resolves.toEqual(created);
		expect(sent(fetchMock)).toEqual({
			method: 'POST',
			url: `/api/polls/${pollId}/responses`,
			authorization: undefined,
			body: { ciphertext },
		});
	});

	it('updateResponse puts the ciphertext with the edit token', async () => {
		const fetchMock = respond(200, { id: responseId, updatedAt: 4 });

		await expect(api.updateResponse(pollId, responseId, token, ciphertext)).resolves.toEqual({
			id: responseId,
			updatedAt: 4,
		});
		expect(sent(fetchMock)).toEqual({
			method: 'PUT',
			url: `/api/polls/${pollId}/responses/${responseId}`,
			authorization: `Bearer ${token}`,
			body: { ciphertext },
		});
	});

	it('deleteResponse deletes with the given token', async () => {
		const fetchMock = respond(204, null);

		await expect(api.deleteResponse(pollId, responseId, token)).resolves.toBeUndefined();
		expect(sent(fetchMock)).toEqual({
			method: 'DELETE',
			url: `/api/polls/${pollId}/responses/${responseId}`,
			authorization: `Bearer ${token}`,
			body: null,
		});
	});

	it('passes API errors through', async () => {
		respond(409, { error: { code: 'too_many_responses', message: 'This poll has too many responses.' } });

		await expect(api.createResponse(pollId, ciphertext)).rejects.toMatchObject({
			status: 409,
			code: 'too_many_responses',
		});
	});

	it.each([
		['getPoll', () => api.getPoll('../health')],
		['updatePoll', () => api.updatePoll(pollId.toUpperCase(), token, { closed: true })],
		['deletePoll', () => api.deletePoll('', token)],
		['createResponse', () => api.createResponse(`${pollId}/x`, ciphertext)],
		['updateResponse', () => api.updateResponse(pollId, '..', token, ciphertext)],
		['deleteResponse', () => api.deleteResponse(pollId, `${responseId}?x`, token)],
	])('%s rejects a malformed ID with not_found, without a request', async (_, call) => {
		const fetchMock = respond(200, {});

		await expect(call()).rejects.toEqual(new ApiError(404, 'not_found', 'Not found.'));
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
