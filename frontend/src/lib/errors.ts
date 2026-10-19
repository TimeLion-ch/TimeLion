/** Turns the errors of api.ts and polls.ts into messages for the UI. */

import { ApiError } from './api';
import type { MessageKey } from './i18n.svelte';
import { UnreadablePollError } from './polls';

const byCode = new Map<string, MessageKey>([
	['network_error', 'error.network'],
	['too_many_requests', 'error.rateLimited'],
	['not_found', 'error.notFound'],
	['poll_closed', 'error.pollClosed'],
	['too_many_responses', 'error.tooManyResponses'],
	['ciphertext_too_large', 'error.tooLarge'],
	['invalid_expiry', 'error.invalidExpiry'],
]);

export function errorMessage(error: unknown): MessageKey {
	if (error instanceof UnreadablePollError) {
		return 'error.unreadable';
	}
	if (error instanceof ApiError) {
		return byCode.get(error.code) ?? 'error.generic';
	}
	return 'error.generic';
}

/** Why a poll couldn't be shown. A missing key (`noKey`) is found before loading. */
export type LoadProblem = 'noKey' | 'unreadable' | 'notFound' | 'network' | 'generic';

export function loadProblem(error: unknown): LoadProblem {
	if (error instanceof UnreadablePollError) {
		return 'unreadable';
	}
	if (error instanceof ApiError && error.code === 'not_found') {
		return 'notFound';
	}
	if (error instanceof ApiError && error.code === 'network_error') {
		return 'network';
	}
	return 'generic';
}
