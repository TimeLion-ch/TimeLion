/** The voting form's state and how it becomes a response document (model.ts). */

import type { Params } from './i18n';
import type { MessageKey } from './i18n.svelte';
import { choiceProblem, type Poll, type PollResponse, type Vote } from './model';

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

export type ResponseErrors = { name?: MessageKey; choices?: MessageKey };

/** The name, and in text polls the choice limits (model.ts → `choiceProblem`). */
export function validateResponse(draft: ResponseDraft, poll: Poll): ResponseErrors {
	const errors: ResponseErrors = {};
	if (draft.name.trim() === '') {
		errors.name = 'vote.error.nameRequired';
	}
	const problem = choiceProblem(poll, draft.votes);
	if (problem !== null) {
		errors.choices = problem === 'tooFew' ? 'vote.error.tooFew' : 'vote.error.tooMany';
	}
	return errors;
}

/** How many options to choose, as a message: "2 to 3", "at least 2", "at most 3", "exactly 2"; null without limits. */
export function choiceRule(poll: Poll): { key: MessageKey; params: Params } | null {
	if (poll.type !== 'text') {
		return null;
	}
	const { minChoices: min, maxChoices: max } = poll;
	if (min !== undefined && max !== undefined) {
		if (min !== max) {
			return { key: 'vote.limit.range', params: { min, max } };
		}
		return min === 1
			? { key: 'vote.limit.exactlyOne', params: {} }
			: { key: 'vote.limit.exactly', params: { count: min } };
	}
	if (min !== undefined) {
		return min === 1
			? { key: 'vote.limit.atLeastOne', params: {} }
			: { key: 'vote.limit.atLeast', params: { count: min } };
	}
	if (max !== undefined) {
		return max === 1
			? { key: 'vote.limit.atMostOne', params: {} }
			: { key: 'vote.limit.atMost', params: { count: max } };
	}
	return null;
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
