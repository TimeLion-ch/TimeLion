/** The voting form's state and how it becomes a response document (model.ts). */

import type { MessageKey } from './i18n.svelte';
import type { Poll, PollResponse, Vote } from './model';

export type ResponseDraft = {
	name: string;
	/** Option ID → vote; options without a vote stay unanswered. */
	votes: Record<string, Vote>;
	comment: string;
};

export function emptyResponse(): ResponseDraft {
	return { name: '', votes: {}, comment: '' };
}

/** For editing a response; a vote for "maybe" in a poll that no longer allows it is dropped. */
export function draftFromResponse(response: PollResponse, poll: Poll): ResponseDraft {
	const votes: Record<string, Vote> = {};
	for (const { id } of poll.options) {
		const vote = Object.hasOwn(response.votes, id) ? response.votes[id] : undefined;
		if (vote !== undefined && (vote !== 'maybe' || poll.allowMaybe)) {
			votes[id] = vote;
		}
	}
	return { name: response.name, votes, comment: response.comment ?? '' };
}

export function validateResponse(draft: ResponseDraft): { name?: MessageKey } {
	return draft.name.trim() === '' ? { name: 'vote.error.nameRequired' } : {};
}

/** The response document: trimmed texts, no empty comment, votes only for the poll's options. */
export function buildResponse(draft: ResponseDraft, poll: Poll): PollResponse {
	const votes: Record<string, Vote> = {};
	for (const { id } of poll.options) {
		const vote = Object.hasOwn(draft.votes, id) ? draft.votes[id] : undefined;
		if (vote !== undefined) {
			votes[id] = vote;
		}
	}
	const response: PollResponse = { v: 1, name: draft.name.trim(), votes };
	const comment = draft.comment.trim();
	if (comment !== '') {
		response.comment = comment;
	}
	return response;
}

/** The votes a poll offers. */
export function choices(poll: Poll): Vote[] {
	return poll.allowMaybe ? ['yes', 'maybe', 'no'] : ['yes', 'no'];
}
