import { describe, expect, it } from 'vitest';
import { parseResponse, type Poll, type TextPoll } from './model';
import {
	buildResponse,
	choiceRule,
	choices,
	draftFromResponse,
	emptyResponse,
	validateResponse,
	type ResponseDraft,
} from './responseDraft';

const poll: Poll = {
	v: 1,
	type: 'dates',
	title: 'Grillabend',
	timezone: 'Europe/Zurich',
	options: [
		{ id: 'aaaaaaaa', start: '2026-11-03' },
		{ id: 'bbbbbbbb', start: '2026-11-04' },
	],
	allowMaybe: true,
};

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

describe('validateResponse', () => {
	it('requires a name that is not blank', () => {
		expect(validateResponse(emptyResponse(), poll)).toEqual({ name: 'vote.error.nameRequired' });
		expect(validateResponse({ ...emptyResponse(), name: '  ' }, poll)).toEqual({ name: 'vote.error.nameRequired' });
		expect(validateResponse({ ...emptyResponse(), name: 'Zoë' }, poll)).toEqual({});
	});

	it('checks the choice limits of text polls, counting yes and maybe', () => {
		const draft = (votes: ResponseDraft['votes']): ResponseDraft => ({ name: 'Zoë', votes, comment: '' });

		expect(validateResponse(draft({}), lunch)).toEqual({ choices: 'vote.error.tooFew' });
		expect(validateResponse(draft({ aaaaaaaa: 'no', bbbbbbbb: 'no' }), lunch).choices).toBe('vote.error.tooFew');
		expect(validateResponse(draft({ aaaaaaaa: 'maybe' }), lunch)).toEqual({});
		expect(validateResponse(draft({ aaaaaaaa: 'yes', bbbbbbbb: 'maybe', cccccccc: 'no' }), lunch)).toEqual({});
		expect(validateResponse(draft({ aaaaaaaa: 'yes', bbbbbbbb: 'yes', cccccccc: 'maybe' }), lunch)).toEqual({
			choices: 'vote.error.tooMany',
		});
		expect(validateResponse({ ...draft({}), name: '' }, lunch)).toEqual({
			name: 'vote.error.nameRequired',
			choices: 'vote.error.tooFew',
		});
	});

	it('finds no choice problem without limits or in a date poll', () => {
		const { minChoices: _min, maxChoices: _max, ...unlimited } = lunch;

		expect(validateResponse({ name: 'Zoë', votes: {}, comment: '' }, unlimited)).toEqual({});
		expect(validateResponse({ name: 'Zoë', votes: {}, comment: '' }, poll)).toEqual({});
	});

	it('shows a response that no longer fits changed limits as a problem when it is edited', () => {
		const draft = draftFromResponse(
			{ v: 1, name: 'Zoë', votes: { aaaaaaaa: 'yes', bbbbbbbb: 'yes', cccccccc: 'yes' } },
			lunch,
		);

		expect(validateResponse(draft, lunch)).toEqual({ choices: 'vote.error.tooMany' });
	});
});

describe('choiceRule', () => {
	it.each([
		[1, 2, 'vote.limit.range', { min: 1, max: 2 }],
		[2, 2, 'vote.limit.exactly', { count: 2 }],
		[1, 1, 'vote.limit.exactlyOne', {}],
		[2, undefined, 'vote.limit.atLeast', { count: 2 }],
		[1, undefined, 'vote.limit.atLeastOne', {}],
		[undefined, 3, 'vote.limit.atMost', { count: 3 }],
		[undefined, 1, 'vote.limit.atMostOne', {}],
	])('describes the limits %s to %s', (minChoices, maxChoices, key, params) => {
		const { minChoices: _min, maxChoices: _max, ...unlimited } = lunch;
		const limited: TextPoll = { ...unlimited };
		if (minChoices !== undefined) {
			limited.minChoices = minChoices;
		}
		if (maxChoices !== undefined) {
			limited.maxChoices = maxChoices;
		}

		expect(choiceRule(limited)).toEqual({ key, params });
	});

	it('is null without limits and for date polls', () => {
		const { minChoices: _min, maxChoices: _max, ...unlimited } = lunch;

		expect(choiceRule(unlimited)).toBeNull();
		expect(choiceRule(poll)).toBeNull();
	});
});

describe('buildResponse', () => {
	it('builds a valid response document', () => {
		const response = buildResponse(
			{ name: ' Zoë ', votes: { aaaaaaaa: 'yes', zzzzzzzz: 'no' }, comment: ' Gerne! ' },
			poll,
		);
		expect(response).toEqual({ v: 1, name: 'Zoë', votes: { aaaaaaaa: 'yes' }, comment: 'Gerne!' });
		expect(parseResponse(response, poll)).toEqual(response);
	});

	it('leaves out an empty comment', () => {
		expect(buildResponse({ name: 'Max', votes: {}, comment: '   ' }, poll)).not.toHaveProperty('comment');
	});
});

describe('draftFromResponse', () => {
	it('fills the form from a response', () => {
		const draft = draftFromResponse(
			{ v: 1, name: 'Zoë', votes: { aaaaaaaa: 'maybe', bbbbbbbb: 'no' }, comment: 'Gerne' },
			poll,
		);
		expect(draft).toEqual({ name: 'Zoë', votes: { aaaaaaaa: 'maybe', bbbbbbbb: 'no' }, comment: 'Gerne' });
	});

	it('drops maybe votes when the poll no longer allows them', () => {
		const draft = draftFromResponse(
			{ v: 1, name: 'Zoë', votes: { aaaaaaaa: 'maybe', bbbbbbbb: 'yes' } },
			{
				...poll,
				allowMaybe: false,
			},
		);
		expect(draft.votes).toEqual({ bbbbbbbb: 'yes' });
	});
});

describe('choices', () => {
	it('offers maybe only if the poll allows it', () => {
		expect(choices(poll)).toEqual(['yes', 'maybe', 'no']);
		expect(choices({ ...poll, allowMaybe: false })).toEqual(['yes', 'no']);
	});
});
