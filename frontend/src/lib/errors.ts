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
