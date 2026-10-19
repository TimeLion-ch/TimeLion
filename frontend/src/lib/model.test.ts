import { describe, expect, it } from 'vitest';
import { parsePoll, parseResponse, type Poll } from './model';

const validPoll = {
	v: 1,
	title: 'Grillabend',
	description: 'Bring etwas zum Grillieren mit.',
	location: 'Bürkliplatz',
	timezone: 'Europe/Zurich',
	options: [
		{ id: '0a1b2c3d', start: '2026-11-03' },
		{ id: '1a2b3c4d', start: '2026-11-04T18:00', end: '2026-11-04T22:00' },
		{ id: '2a3b4c5d', start: '2026-11-06', end: '2026-11-08' },
	],
	allowMaybe: true,
	finalOptionId: '1a2b3c4d',
};

const poll = parsePoll(validPoll) as Poll;

const validResponse = { v: 1, name: 'Zoë', votes: { '0a1b2c3d': 'yes', '1a2b3c4d': 'maybe' }, comment: 'Gern!' };

const withPoll = (changes: Record<string, unknown>) => ({ ...validPoll, ...changes });
const withResponse = (changes: Record<string, unknown>) => ({ ...validResponse, ...changes });
const withOption = (option: unknown) => withPoll({ options: [option] });

/** Nests arrays 100,000 levels deep (far beyond the call stack) without JSON.parse, so recursing into it would throw. */
function deeplyNested(): unknown {
	let value: unknown = 'x';
	for (let i = 0; i < 100_000; i++) {
		value = [value];
	}
	return value;
}

describe('parsePoll', () => {
	it('returns a valid poll unchanged', () => {
		expect(parsePoll(validPoll)).toEqual(validPoll);
	});

	it('accepts a minimal poll without the optional fields', () => {
		const minimal = {
			v: 1,
			title: 'T',
			timezone: 'UTC',
			options: [{ id: 'ffffffff', start: '2026-11-03' }],
			allowMaybe: false,
		};

		expect(parsePoll(minimal)).toEqual(minimal);
	});

	it('accepts the documented limits', () => {
		const options = Array.from({ length: 100 }, (_, i) => ({
			id: i.toString(16).padStart(8, '0'),
			start: '2026-11-03',
		}));
		const largest = withPoll({
			title: 'x'.repeat(200),
			description: 'x'.repeat(2000),
			location: 'x'.repeat(200),
			timezone: 'America/Argentina/Buenos_Aires',
			options,
		});

		expect(parsePoll(largest)).toMatchObject({ title: 'x'.repeat(200), options });
	});

	it('drops unknown fields, including __proto__, without touching any prototype', () => {
		const hostile = JSON.parse(
			JSON.stringify(
				withPoll({ extra: 'x', options: [{ id: '0a1b2c3d', start: '2026-11-03', note: 'x' }] }),
			).replace(/^\{/, '{"__proto__":{"polluted":true},'),
		) as unknown;

		const parsed = parsePoll(hostile);

		expect(parsed).not.toHaveProperty('extra');
		expect(parsed?.options[0]).toEqual({ id: '0a1b2c3d', start: '2026-11-03' });
		expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
		expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
	});

	it('ignores a final option that does not exist', () => {
		expect(parsePoll(withPoll({ finalOptionId: 'ffffffff' }))).not.toHaveProperty('finalOptionId');
		expect(parsePoll(withPoll({ finalOptionId: 42 }))).not.toHaveProperty('finalOptionId');
	});

	it.each([
		['null', null],
		['a string', 'poll'],
		['an array', [validPoll]],
		['another version', withPoll({ v: 2 })],
		['a string version', withPoll({ v: '1' })],
		['a missing title', withPoll({ title: undefined })],
		['an empty title', withPoll({ title: '' })],
		['a blank title', withPoll({ title: ' \n\t ' })],
		['a title that is too long', withPoll({ title: 'x'.repeat(201) })],
		['a huge title', withPoll({ title: 'x'.repeat(10_000_000) })],
		['a numeric title', withPoll({ title: 42 })],
		['a title object', withPoll({ title: { toString: () => 'T' } })],
		['a description that is too long', withPoll({ description: 'x'.repeat(2001) })],
		['a null description', withPoll({ description: null })],
		['a location that is too long', withPoll({ location: 'x'.repeat(201) })],
		['a numeric location', withPoll({ location: 1 })],
		['a missing timezone', withPoll({ timezone: undefined })],
		['an unknown timezone', withPoll({ timezone: 'Mars/Olympus_Mons' })],
		['an offset instead of a timezone', withPoll({ timezone: '+01:00' })],
		['a huge timezone', withPoll({ timezone: 'Europe/' + 'x'.repeat(100_000) })],
		['no options', withPoll({ options: [] })],
		['too many options', withPoll({ options: Array.from({ length: 101 }, () => validPoll.options[0]) })],
		['a huge options array', withPoll({ options: new Array(10_000_000) })],
		['options as an object', withPoll({ options: { 0: validPoll.options[0], length: 1 } })],
		['duplicate option IDs', withPoll({ options: [validPoll.options[0], validPoll.options[0]] })],
		['allowMaybe as a string', withPoll({ allowMaybe: 'true' })],
		['a missing allowMaybe', withPoll({ allowMaybe: undefined })],
		['a deeply nested title', withPoll({ title: deeplyNested() })],
		['deeply nested options', withPoll({ options: deeplyNested() })],
	])('rejects %s', (_, value) => {
		expect(parsePoll(value)).toBeNull();
	});

	it('ignores deeply nested values in unknown fields', () => {
		expect(parsePoll(withPoll({ extra: deeplyNested() }))).toEqual(validPoll);
	});

	it('ignores inherited fields', () => {
		expect(parsePoll(Object.create(validPoll))).toBeNull();
	});

	it.each([
		['an option that is not an object', 'x'],
		['a sparse options array', [, validPoll.options[0]]],
		['an option ID with uppercase hex', { id: '0A1B2C3D', start: '2026-11-03' }],
		['a short option ID', { id: '0a1b2c3', start: '2026-11-03' }],
		['a numeric option ID', { id: 12345678, start: '2026-11-03' }],
		['an option ID of __proto__', { id: '__proto__', start: '2026-11-03' }],
		['a missing start', { id: '0a1b2c3d' }],
		['a numeric start', { id: '0a1b2c3d', start: 20261103 }],
		['February 29 in a common year', { id: '0a1b2c3d', start: '2026-02-29' }],
		['February 29 in 1900', { id: '0a1b2c3d', start: '1900-02-29' }],
		['April 31', { id: '0a1b2c3d', start: '2026-04-31' }],
		['month 13', { id: '0a1b2c3d', start: '2026-13-01' }],
		['day 0', { id: '0a1b2c3d', start: '2026-11-00' }],
		['hour 24', { id: '0a1b2c3d', start: '2026-11-03T24:00' }],
		['minute 60', { id: '0a1b2c3d', start: '2026-11-03T12:60' }],
		['a space instead of T', { id: '0a1b2c3d', start: '2026-11-03 12:00' }],
		['an offset', { id: '0a1b2c3d', start: '2026-11-03T12:00Z' }],
		['seconds', { id: '0a1b2c3d', start: '2026-11-03T12:00:00' }],
		['a trailing newline', { id: '0a1b2c3d', start: '2026-11-03\n' }],
		['an end before the start', { id: '0a1b2c3d', start: '2026-11-03T12:00', end: '2026-11-03T11:00' }],
		['an end equal to the start', { id: '0a1b2c3d', start: '2026-11-03', end: '2026-11-03' }],
		['an end time for a whole day', { id: '0a1b2c3d', start: '2026-11-03', end: '2026-11-03T12:00' }],
		['an end day for a time', { id: '0a1b2c3d', start: '2026-11-03T12:00', end: '2026-11-04' }],
		['a null end', { id: '0a1b2c3d', start: '2026-11-03', end: null }],
	])('rejects %s', (_, option) => {
		const options = Array.isArray(option) ? option : [option];

		expect(parsePoll(withPoll({ options, finalOptionId: undefined }))).toBeNull();
	});

	it('accepts leap days and times that end on the next day', () => {
		expect(parsePoll(withOption({ id: '0a1b2c3d', start: '2028-02-29' }))).not.toBeNull();
		expect(parsePoll(withOption({ id: '0a1b2c3d', start: '2000-02-29' }))).not.toBeNull();
		expect(
			parsePoll(withOption({ id: '0a1b2c3d', start: '2026-11-03T22:00', end: '2026-11-04T01:30' })),
		).not.toBeNull();
	});
});

describe('parseResponse', () => {
	it('returns a valid response unchanged', () => {
		expect(parseResponse(validResponse, poll)).toEqual(validResponse);
	});

	it('accepts a response without votes or comment, and the documented limits', () => {
		expect(parseResponse({ v: 1, name: 'x'.repeat(80), votes: {} }, poll)).toEqual({
			v: 1,
			name: 'x'.repeat(80),
			votes: {},
		});
		expect(parseResponse(withResponse({ comment: 'x'.repeat(500) }), poll)).not.toBeNull();
	});

	it('ignores votes for unknown options and votes with unknown values', () => {
		const votes = { '0a1b2c3d': 'yes', '1a2b3c4d': 'perhaps', '2a3b4c5d': 1, ffffffff: 'no', length: 'yes' };

		expect(parseResponse(withResponse({ votes }), poll)?.votes).toEqual({ '0a1b2c3d': 'yes' });
	});

	it('ignores __proto__ in votes and drops unknown fields', () => {
		const hostile = JSON.parse(
			'{"v":1,"name":"Eve","extra":1,"votes":{"__proto__":{"0a1b2c3d":"yes"},"1a2b3c4d":"no"}}',
		) as unknown;

		const parsed = parseResponse(hostile, poll);

		expect(parsed).toEqual({ v: 1, name: 'Eve', votes: { '1a2b3c4d': 'no' } });
		expect(Object.getPrototypeOf(parsed?.votes)).toBe(Object.prototype);
	});

	it('ignores inherited votes', () => {
		expect(parseResponse(withResponse({ votes: Object.create({ '0a1b2c3d': 'yes' }) }), poll)?.votes).toEqual({});
	});

	it('handles a huge votes object in bounded time', () => {
		const votes = Object.fromEntries(Array.from({ length: 200_000 }, (_, i) => [`k${i}`, 'yes']));

		expect(parseResponse(withResponse({ votes }), poll)?.votes).toEqual({});
	});

	it.each([
		['null', null],
		['an array', [validResponse]],
		['another version', withResponse({ v: 2 })],
		['a missing name', withResponse({ name: undefined })],
		['a blank name', withResponse({ name: '   ' })],
		['a name that is too long', withResponse({ name: 'x'.repeat(81) })],
		['a huge name', withResponse({ name: 'x'.repeat(10_000_000) })],
		['a numeric name', withResponse({ name: 7 })],
		['missing votes', withResponse({ votes: undefined })],
		['votes as an array', withResponse({ votes: ['yes'] })],
		['votes as a string', withResponse({ votes: 'yes' })],
		['a comment that is too long', withResponse({ comment: 'x'.repeat(501) })],
		['a comment array', withResponse({ comment: ['x'] })],
		['a deeply nested name', withResponse({ name: deeplyNested() })],
		['deeply nested votes', withResponse({ votes: deeplyNested() })],
	])('rejects %s', (_, value) => {
		expect(parseResponse(value, poll)).toBeNull();
	});
});
