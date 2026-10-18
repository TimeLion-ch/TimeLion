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
