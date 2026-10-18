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

export const api = {
	health: () => request<{ status: 'ok' }>('GET', '/health'),
};
