import { describe, expect, it } from 'vitest';
import type { Poll, PollResponse } from './model';
import { bestOptions, hasTimes, score, tally } from './results';

const poll: Poll = {
	v: 1,
	type: 'dates',
	title: 'Grillabend',
	timezone: 'Europe/Zurich',
	options: [
		{ id: 'aaaaaaaa', start: '2026-11-03' },
		{ id: 'bbbbbbbb', start: '2026-11-04' },
		{ id: 'cccccccc', start: '2026-11-05' },
	],
	allowMaybe: true,
};

const response = (votes: PollResponse['votes']): PollResponse => ({ v: 1, name: 'X', votes });

describe('tally', () => {
	it('counts votes per option, including missing answers', () => {
		const tallies = tally(poll, [
			response({ aaaaaaaa: 'yes', bbbbbbbb: 'maybe' }),
			response({ aaaaaaaa: 'yes', bbbbbbbb: 'no', cccccccc: 'maybe' }),
		]);
		expect(tallies.get('aaaaaaaa')).toEqual({ yes: 2, maybe: 0, no: 0, unanswered: 0 });
		expect(tallies.get('bbbbbbbb')).toEqual({ yes: 0, maybe: 1, no: 1, unanswered: 0 });
		expect(tallies.get('cccccccc')).toEqual({ yes: 0, maybe: 1, no: 0, unanswered: 1 });
	});

	it('ignores inherited properties of the votes', () => {
		const votes = Object.create({ aaaaaaaa: 'yes' }) as PollResponse['votes'];
		expect(tally(poll, [response(votes)]).get('aaaaaaaa')).toEqual({ yes: 0, maybe: 0, no: 0, unanswered: 1 });
	});
});

describe('bestOptions', () => {
	it('picks the highest score, counting maybe as half a yes', () => {
		expect(score({ yes: 2, maybe: 1, no: 0, unanswered: 0 })).toBe(5);
		const tallies = tally(poll, [
			response({ aaaaaaaa: 'yes', bbbbbbbb: 'maybe', cccccccc: 'maybe' }),
			response({ aaaaaaaa: 'no', bbbbbbbb: 'yes', cccccccc: 'maybe' }),
		]);
		expect(bestOptions(tallies)).toEqual(new Set(['bbbbbbbb']));
	});

	it('returns every tied option', () => {
		const tallies = tally(poll, [response({ aaaaaaaa: 'yes', cccccccc: 'yes' })]);
		expect(bestOptions(tallies)).toEqual(new Set(['aaaaaaaa', 'cccccccc']));
	});

	it('returns none without any yes or maybe', () => {
		expect(bestOptions(tally(poll, []))).toEqual(new Set());
		expect(bestOptions(tally(poll, [response({ aaaaaaaa: 'no' })]))).toEqual(new Set());
	});
});

describe('hasTimes', () => {
	it('is false for text polls', () => {
		expect(hasTimes({ ...poll, type: 'text', options: [{ id: 'aaaaaaaa', text: '18:00' }] })).toBe(false);
	});

	it('is true if any option has a time', () => {
		expect(hasTimes(poll)).toBe(false);
		expect(hasTimes({ ...poll, options: [...poll.options, { id: 'dddddddd', start: '2026-11-06T18:00' }] })).toBe(
			true,
		);
	});
});
