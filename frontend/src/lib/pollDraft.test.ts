import { describe, expect, it } from 'vitest';
import { serverLimits } from './api';
import { parsePoll, type Poll } from './model';
import {
	buildPoll,
	copySlots,
	defaultExpiryDate,
	draftFromPoll,
	editedPoll,
	emptyDraft,
	endsNextDay,
	expiresAt,
	maxExpiryDate,
	newOptionId,
	optionCount,
	removedOptions,
	slotKey,
	toggleDay,
	validateDraft,
	type PollDraft,
} from './pollDraft';

const today = '2026-10-19';

function draft(changes: Partial<PollDraft> = {}): PollDraft {
	return {
		...emptyDraft('Europe/Zurich', today),
		title: 'Grillabend',
		days: [{ date: '2026-11-03', slots: [] }],
		...changes,
	};
}

describe('toggleDay', () => {
	it('adds dates in order and removes them again', () => {
		let days = toggleDay([], '2026-11-05');
		days = toggleDay(days, '2026-11-03');
		days = toggleDay(days, '2026-11-04');
		expect(days.map((day) => day.date)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']);
		expect(toggleDay(days, '2026-11-04').map((day) => day.date)).toEqual(['2026-11-03', '2026-11-05']);
		expect(days.every((day) => day.slots.length === 0)).toBe(true);
	});
});

describe('time slots', () => {
	it('copies the slots of one day to all days', () => {
		const days = copySlots(
			[
				{ date: '2026-11-03', slots: [{ start: '18:00', end: '22:00' }] },
				{ date: '2026-11-04', slots: [] },
				{ date: '2026-11-05', slots: [{ start: '08:00', end: '' }] },
			],
			'2026-11-03',
		);
		expect(days.map((day) => day.slots)).toEqual([
			[{ start: '18:00', end: '22:00' }],
			[{ start: '18:00', end: '22:00' }],
			[{ start: '18:00', end: '22:00' }],
		]);
		expect(days[1]?.slots[0]).not.toBe(days[0]?.slots[0]);
	});

	it('copies slots as new options, without the IDs of the original ones', () => {
		const days = copySlots(
			[
				{ date: '2026-11-03', slots: [{ id: 'aaaaaaaa', start: '18:00', end: '' }] },
				{ date: '2026-11-04', slots: [{ id: 'bbbbbbbb', start: '09:00', end: '' }] },
			],
			'2026-11-03',
		);
		expect(days[0]?.slots).toEqual([{ id: 'aaaaaaaa', start: '18:00', end: '' }]);
		expect(days[1]?.slots).toEqual([{ start: '18:00', end: '' }]);
	});

	it('counts a day without slots as one option', () => {
		const days = [
			{ date: '2026-11-03', slots: [] },
			{
				date: '2026-11-04',
				slots: [
					{ start: '09:00', end: '' },
					{ start: '14:00', end: '' },
				],
			},
		];
		expect(optionCount({ days })).toBe(3);
	});

	it('knows when a slot ends on the next day', () => {
		expect(endsNextDay({ start: '22:00', end: '01:00' })).toBe(true);
		expect(endsNextDay({ start: '18:00', end: '22:00' })).toBe(false);
		expect(endsNextDay({ start: '18:00', end: '' })).toBe(false);
	});
});

describe('expiry', () => {
	it('defaults to 30 days after the last date', () => {
		const days = [
			{ date: '2026-11-03', slots: [] },
			{ date: '2026-12-01', slots: [] },
		];
		expect(defaultExpiryDate(days, today)).toBe('2026-12-31');
		expect(defaultExpiryDate([], today)).toBe('2026-11-18');
		expect(emptyDraft('UTC', today).expiryDate).toBe('2026-11-18');
	});

	it('is capped at the maximum lifetime', () => {
		expect(maxExpiryDate(today)).toBe('2027-10-18');
		expect(defaultExpiryDate([{ date: '2027-10-01', slots: [] }], today)).toBe('2027-10-18');
	});

	it('ends with the expiry day in the poll timezone', () => {
		const now = Date.parse('2026-10-19T10:00:00Z') / 1000;
		expect(expiresAt({ expiryDate: '2026-12-31', timezone: 'Europe/Zurich' }, now)).toBe(
			Date.parse('2026-12-31T23:00:00Z') / 1000,
		);
		expect(expiresAt({ expiryDate: '2026-12-31', timezone: 'UTC' }, now)).toBe(
			Date.parse('2027-01-01T00:00:00Z') / 1000,
		);
	});

	it('stays below the server maximum, also at the latest allowed day', () => {
		const now = Date.parse('2026-10-19T22:30:00Z') / 1000;
		const latest = expiresAt({ expiryDate: maxExpiryDate('2026-10-20'), timezone: 'Pacific/Kiritimati' }, now);
		expect(latest).toBeLessThanOrEqual(now + serverLimits.maxLifetime);
		expect(latest).toBeGreaterThan(now);
	});
});

describe('validateDraft', () => {
	it('accepts a complete draft', () => {
		expect(validateDraft(draft(), today)).toEqual({});
	});

	it('requires a title that is not blank', () => {
		expect(validateDraft(draft({ title: '   ' }), today).title).toBe('form.error.titleRequired');
	});

	it('requires at least one date and at most the option limit', () => {
		expect(validateDraft(draft({ days: [] }), today).days).toBe('form.error.datesRequired');
		const slots = Array.from({ length: 51 }, (_, index) => ({
			start: `${String(index % 24).padStart(2, '0')}:00`,
			end: '',
		}));
		const days = [
			{ date: '2026-11-03', slots },
			{ date: '2026-11-04', slots },
		];
		expect(validateDraft(draft({ days }), today).days).toBe('form.error.tooManyOptions');
		expect(validateDraft(draft({ days: days.slice(0, 1) }), today).days).toBeUndefined();
	});

	it('checks every slot', () => {
		const days = [
			{
				date: '2026-11-03',
				slots: [
					{ start: '', end: '' },
					{ start: '18:00', end: '18:00' },
					{ start: '18:00', end: '22:00' },
					{ start: '18:00', end: '22:00' },
					{ start: '20:00', end: '7 pm' },
					{ start: '22:00', end: '01:00' },
				],
			},
		];
		expect(validateDraft(draft({ days }), today).slots).toEqual({
			[slotKey('2026-11-03', 0)]: 'form.error.startRequired',
			[slotKey('2026-11-03', 1)]: 'form.error.endEqualsStart',
			[slotKey('2026-11-03', 3)]: 'form.error.duplicateTime',
			[slotKey('2026-11-03', 4)]: 'form.error.endInvalid',
		});
	});

	it('checks the expiry date', () => {
		expect(validateDraft(draft({ expiryDate: '' }), today).expiry).toBe('form.error.expiryInvalid');
		expect(validateDraft(draft({ expiryDate: '2026-10-18' }), today).expiry).toBe('form.error.expiryInvalid');
		expect(validateDraft(draft({ expiryDate: today }), today).expiry).toBeUndefined();
		expect(validateDraft(draft({ expiryDate: '2027-10-19' }), today).expiry).toBe('form.error.expiryTooLate');
	});
});

describe('buildPoll', () => {
	it('builds a valid poll document with one whole-day option per date', () => {
		const poll = buildPoll(
			draft({
				title: '  Grillabend ',
				description: ' ',
				location: 'Bern',
				days: [
					{ date: '2026-11-03', slots: [] },
					{ date: '2026-11-04', slots: [] },
				],
			}),
		);
		expect(parsePoll(poll)).toEqual(poll);
		expect(poll).toMatchObject({ v: 1, title: 'Grillabend', location: 'Bern', timezone: 'Europe/Zurich' });
		expect(poll).not.toHaveProperty('description');
		expect(poll.options.map((option) => option.start)).toEqual(['2026-11-03', '2026-11-04']);
	});

	it('gives every option a different ID', () => {
		const ids = ['aaaaaaaa', 'aaaaaaaa', 'bbbbbbbb'];
		const days = [
			{ date: '2026-11-03', slots: [] },
			{ date: '2026-11-04', slots: [] },
		];
		const poll = buildPoll(draft({ days }), () => ids.shift()!);
		expect(poll.options.map((option) => option.id)).toEqual(['aaaaaaaa', 'bbbbbbbb']);
	});

	it('turns slots into timed options in order, ending on the next day if the end is earlier', () => {
		const poll = buildPoll(
			draft({
				days: [
					{
						date: '2026-11-03',
						slots: [
							{ start: '22:00', end: '01:00' },
							{ start: '09:00', end: '' },
							{ start: '09:00', end: '10:30' },
						],
					},
					{ date: '2026-11-04', slots: [] },
				],
			}),
		);
		expect(parsePoll(poll)).toEqual(poll);
		expect(poll.options.map(({ start, end }) => [start, end])).toEqual([
			['2026-11-03T09:00', undefined],
			['2026-11-03T09:00', '2026-11-03T10:30'],
			['2026-11-03T22:00', '2026-11-04T01:00'],
			['2026-11-04', undefined],
		]);
	});
});

describe('newOptionId', () => {
	it('returns 8 lowercase hex characters', () => {
		expect(newOptionId()).toMatch(/^[0-9a-f]{8}$/);
	});
});

describe('editing a poll', () => {
	const poll: Poll = {
		v: 1,
		title: 'Grillabend',
		description: 'Mit Salat',
		timezone: 'Europe/Zurich',
		options: [
			{ id: 'aaaaaaaa', start: '2026-11-03' },
			{ id: 'bbbbbbbb', start: '2026-11-04T18:00', end: '2026-11-04T22:00' },
			{ id: 'cccccccc', start: '2026-11-04T22:00', end: '2026-11-05T01:00' },
			{ id: 'dddddddd', start: '2026-11-06T09:00' },
		],
		allowMaybe: false,
		finalOptionId: 'bbbbbbbb',
	};
	// The end of 2026-12-31 in Zurich.
	const expires = Date.parse('2026-12-31T23:00:00Z') / 1000;

	it('turns a poll into a draft and back without changes', () => {
		const draft = draftFromPoll(poll, expires);
		expect(draft).toMatchObject({
			title: 'Grillabend',
			description: 'Mit Salat',
			location: '',
			allowMaybe: false,
			expiryDate: '2026-12-31',
		});
		expect(draft.days).toEqual([
			{ date: '2026-11-03', slots: [], id: 'aaaaaaaa' },
			{
				date: '2026-11-04',
				slots: [
					{ id: 'bbbbbbbb', start: '18:00', end: '22:00' },
					{ id: 'cccccccc', start: '22:00', end: '01:00' },
				],
			},
			{ date: '2026-11-06', slots: [{ id: 'dddddddd', start: '09:00', end: '' }] },
		]);
		expect(editedPoll(poll, draft)).toEqual(poll);
	});

	it('keeps the IDs of changed options and gives new options new IDs', () => {
		const draft = draftFromPoll(poll, expires);
		draft.days[1]!.slots[0]!.end = '23:00';
		draft.days = toggleDay(draft.days, '2026-11-07');
		const edited = editedPoll(poll, draft, () => 'eeeeeeee');
		expect(edited.options.find((option) => option.id === 'bbbbbbbb')?.end).toBe('2026-11-04T23:00');
		expect(edited.options.at(-1)).toEqual({ id: 'eeeeeeee', start: '2026-11-07' });
		expect(removedOptions(poll, edited)).toEqual([]);
	});

	it('reports removed options and drops a removed final option', () => {
		const draft = draftFromPoll(poll, expires);
		draft.days[1]!.slots.splice(0, 1);
		draft.days = toggleDay(draft.days, '2026-11-03');
		const edited = editedPoll(poll, draft);
		expect(removedOptions(poll, edited).map((option) => option.id)).toEqual(['aaaaaaaa', 'bbbbbbbb']);
		expect(edited).not.toHaveProperty('finalOptionId');
	});

	it('never reuses an ID for a new option', () => {
		const draft = draftFromPoll(poll, expires);
		draft.days = toggleDay(draft.days, '2026-11-07');
		const ids = ['aaaaaaaa', 'ffffffff'];
		expect(editedPoll(poll, draft, () => ids.shift()!).options.at(-1)?.id).toBe('ffffffff');
	});
});
