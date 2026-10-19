import { describe, expect, it } from 'vitest';
import { parseResponse, type Poll } from './model';
import { buildResponse, choices, draftFromResponse, emptyResponse, validateResponse } from './responseDraft';

const poll: Poll = {
	v: 1,
	title: 'Grillabend',
	timezone: 'Europe/Zurich',
	options: [
		{ id: 'aaaaaaaa', start: '2026-11-03' },
		{ id: 'bbbbbbbb', start: '2026-11-04' },
	],
	allowMaybe: true,
};

describe('validateResponse', () => {
	it('requires a name that is not blank', () => {
		expect(validateResponse(emptyResponse())).toEqual({ name: 'vote.error.nameRequired' });
		expect(validateResponse({ ...emptyResponse(), name: '  ' })).toEqual({ name: 'vote.error.nameRequired' });
		expect(validateResponse({ ...emptyResponse(), name: 'Zoë' })).toEqual({});
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
