import { describe, expect, it } from 'vitest';
import de from '../locales/de.json';
import { ApiError } from './api';
import { errorMessage, loadProblem } from './errors';
import { UnreadablePollError } from './polls';

describe('errorMessage', () => {
	it('maps API error codes to messages', () => {
		expect(errorMessage(new ApiError(0, 'network_error', ''))).toBe('error.network');
		expect(errorMessage(new ApiError(429, 'too_many_requests', ''))).toBe('error.rateLimited');
		expect(errorMessage(new ApiError(404, 'not_found', ''))).toBe('error.notFound');
		expect(errorMessage(new ApiError(409, 'poll_closed', ''))).toBe('error.pollClosed');
		expect(errorMessage(new ApiError(403, 'forbidden', ''))).toBe('error.forbidden');
	});

	it('falls back to a generic message', () => {
		expect(errorMessage(new ApiError(500, 'internal_error', ''))).toBe('error.generic');
		expect(errorMessage(new ApiError(400, 'constructor', ''))).toBe('error.generic');
		expect(errorMessage(new TypeError('Invalid poll document.'))).toBe('error.generic');
	});

	it('explains a wrong or incomplete link', () => {
		expect(errorMessage(new UnreadablePollError())).toBe('error.unreadable');
	});

	it('only returns keys that exist', () => {
		const codes = ['network_error', 'too_many_requests', 'not_found', 'poll_closed', 'too_many_responses'];
		for (const code of [...codes, 'ciphertext_too_large', 'invalid_expiry']) {
			expect(de).toHaveProperty([errorMessage(new ApiError(400, code, ''))]);
		}
	});
});

describe('loadProblem', () => {
	it('tells a wrong link, a missing poll and a missing connection apart', () => {
		expect(loadProblem(new UnreadablePollError())).toBe('unreadable');
		expect(loadProblem(new ApiError(404, 'not_found', ''))).toBe('notFound');
		expect(loadProblem(new ApiError(0, 'network_error', ''))).toBe('network');
		expect(loadProblem(new ApiError(500, 'internal_error', ''))).toBe('generic');
		expect(loadProblem(new Error('boom'))).toBe('generic');
	});
});
