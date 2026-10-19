/**
 * Thin fetch wrapper for the TimeLion API (/api). Every failure becomes an ApiError whose `code`
 * matches the backend's `{"error": {"code": ...}}` (see docs/api.md); `network_error` means no response.
 */

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export type RequestOptions = {
	body?: unknown;
	/** Admin or edit token, sent as `Authorization: Bearer …` – never put tokens into URLs. */
	token?: string;
};

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (options.body !== undefined) {
		headers['Content-Type'] = 'application/json';
	}
	if (options.token !== undefined) {
		headers['Authorization'] = `Bearer ${options.token}`;
	}

	let response: Response;
	try {
		response = await fetch(`/api${path}`, {
			method,
			headers,
			body: options.body === undefined ? null : JSON.stringify(options.body),
			cache: 'no-store',
			credentials: 'omit',
			referrerPolicy: 'no-referrer',
		});
	} catch {
		throw new ApiError(0, 'network_error', 'The server could not be reached.');
	}

	const data: unknown = response.status === 204 ? null : await response.json().catch(() => null);
	if (!response.ok) {
		const error = errorBody(data);
		throw new ApiError(response.status, error?.code ?? 'http_error', error?.message ?? `HTTP ${response.status}`);
	}

	return data as T;
}

function errorBody(data: unknown): { code: string; message: string } | null {
	if (typeof data !== 'object' || data === null || !('error' in data)) {
		return null;
	}
	const { error } = data;
	if (typeof error !== 'object' || error === null || !('code' in error) || !('message' in error)) {
		return null;
	}
	return typeof error.code === 'string' && typeof error.message === 'string'
		? { code: error.code, message: error.message }
		: null;
}

/** The limits of the API contract, mirroring src/Polls/Limits.php (docs/api.md → Formats and limits). */
export const serverLimits = {
	pollCiphertextBytes: 64 * 1024,
	responseCiphertextBytes: 16 * 1024,
	responsesPerPoll: 500,
	/** Seconds: `expiresAt` may be at most this far after the request (decision D7: 365 days). */
	maxLifetime: 365 * 24 * 60 * 60,
} as const;

// Response bodies of docs/api.md. Timestamps are Unix seconds; ciphertexts are envelopes (crypto.ts).

export type CreatedPoll = { id: string; adminToken: string; createdAt: number; expiresAt: number };

export type StoredResponse = { id: string; ciphertext: string; createdAt: number; updatedAt: number };

export type StoredPoll = {
	id: string;
	ciphertext: string;
	createdAt: number;
	updatedAt: number;
	expiresAt: number;
	closedAt: number | null;
	/** Oldest first. */
	responses: StoredResponse[];
};

/** At least one field; `closed: false` reopens the poll. */
export type PollPatch = { ciphertext?: string; expiresAt?: number; closed?: boolean };

export type UpdatedPoll = { id: string; updatedAt: number; expiresAt: number; closedAt: number | null };

export type CreatedResponse = { id: string; editToken: string; createdAt: number };

export type UpdatedResponse = { id: string; updatedAt: number };

const ID = /^[0-9a-f]{32}$/;

/**
 * IDs are checked before they go into a path, so that `..` or `/` can't reach another endpoint. A malformed ID gets
 * the same `not_found` as from the server, without a request.
 */
function checkedId(id: string): string {
	if (!ID.test(id)) {
		throw new ApiError(404, 'not_found', 'Not found.');
	}
	return id;
}

const pollPath = (id: string) => `/polls/${checkedId(id)}`;

const responsePath = (pollId: string, responseId: string) => `${pollPath(pollId)}/responses/${checkedId(responseId)}`;

export const api = {
	health: () => request<{ status: 'ok' }>('GET', '/health'),

	createPoll: (ciphertext: string, expiresAt: number) =>
		request<CreatedPoll>('POST', '/polls', { body: { ciphertext, expiresAt } }),

	getPoll: async (id: string) => request<StoredPoll>('GET', pollPath(id)),

	updatePoll: async (id: string, adminToken: string, patch: PollPatch) =>
		request<UpdatedPoll>('PATCH', pollPath(id), { body: patch, token: adminToken }),

	deletePoll: async (id: string, adminToken: string): Promise<void> => {
		await request<null>('DELETE', pollPath(id), { token: adminToken });
	},

	createResponse: async (pollId: string, ciphertext: string) =>
		request<CreatedResponse>('POST', `${pollPath(pollId)}/responses`, { body: { ciphertext } }),

	updateResponse: async (pollId: string, responseId: string, editToken: string, ciphertext: string) =>
		request<UpdatedResponse>('PUT', responsePath(pollId, responseId), { body: { ciphertext }, token: editToken }),

	/** `token` is the response's edit token or the poll's admin token. */
	deleteResponse: async (pollId: string, responseId: string, token: string): Promise<void> => {
		await request<null>('DELETE', responsePath(pollId, responseId), { token });
	},
};
