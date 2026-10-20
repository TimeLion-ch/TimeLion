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
	optionText,
	removedOptions,
	slotKey,
	toggleDay,
	validateDraft,
	type PollDraft,
} from './pollDraft';

const today = '2026-10-19';

/** The options of a date poll; none for a text poll. */
const dated = (poll: Poll) => (poll.type === 'dates' ? poll.options : []);

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
		expect(optionCount({ type: 'dates', days, texts: [] })).toBe(3);
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
		expect(defaultExpiryDate({ type: 'dates', days }, today)).toBe('2026-12-31');
		expect(defaultExpiryDate({ type: 'dates', days: [] }, today)).toBe('2026-11-18');
		expect(emptyDraft('UTC', today).expiryDate).toBe('2026-11-18');
	});

	it('is capped at the maximum lifetime', () => {
		expect(maxExpiryDate(today)).toBe('2027-10-18');
		expect(defaultExpiryDate({ type: 'dates', days: [{ date: '2027-10-01', slots: [] }] }, today)).toBe(
			'2027-10-18',
		);
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
		expect(dated(poll).map((option) => option.start)).toEqual(['2026-11-03', '2026-11-04']);
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
		expect(dated(poll).map(({ start, end }) => [start, end])).toEqual([
			['2026-11-03T09:00', undefined],
			['2026-11-03T09:00', '2026-11-03T10:30'],
			['2026-11-03T22:00', '2026-11-04T01:00'],
			['2026-11-04', undefined],
		]);
	});
});

describe('text polls', () => {
	const textDraft = (changes: Partial<PollDraft> = {}) =>
		draft({
			type: 'text',
			days: [],
			texts: [{ text: 'Pizza' }, { text: 'Sushi' }, { text: 'Curry' }],
			...changes,
		});

	it('start as a date poll, with two empty text options and no limits', () => {
		expect(emptyDraft('UTC', today)).toMatchObject({
			type: 'dates',
			texts: [{ text: '' }, { text: '' }],
			minChoices: '',
			maxChoices: '',
		});
	});

	it('expire 30 days after today by default, whatever dates were picked', () => {
		const days = [{ date: '2026-12-01', slots: [] }];
		expect(defaultExpiryDate({ type: 'text', days }, today)).toBe('2026-11-18');
		expect(optionCount(textDraft({ days }))).toBe(3);
	});

	it('validate only the options of the chosen type', () => {
		// The empty draft has two blank text options and no dates.
		expect(validateDraft(textDraft(), today)).toEqual({});
		expect(validateDraft(draft({ texts: [{ text: '' }], minChoices: 'x' }), today)).toEqual({});
		expect(validateDraft(textDraft({ texts: [] }), today)).toEqual({ texts: 'form.error.optionsRequired' });
		const tooMany = Array.from({ length: 101 }, (_, index) => ({ text: `Option ${index}` }));
		expect(validateDraft(textDraft({ texts: tooMany }), today).texts).toBe('form.error.tooManyTextOptions');
	});

	it('report blank texts and duplicates, trimmed and ignoring case', () => {
		const texts = [{ text: 'Pizza' }, { text: '  ' }, { text: ' pizza ' }, { text: 'Sushi' }, { text: '\t' }];
		expect(validateDraft(textDraft({ texts }), today).textItems).toEqual({
			1: 'form.error.optionTextRequired',
			2: 'form.error.duplicateOption',
			4: 'form.error.optionTextRequired',
		});
	});

	it.each([
		['', '', {}],
		['1', '3', {}],
		[' 2 ', '2', {}],
		['03', '', {}],
		['0', '', { minChoices: 'form.error.limitInvalid' }],
		['-1', '', { minChoices: 'form.error.limitInvalid' }],
		['1.5', '', { minChoices: 'form.error.limitInvalid' }],
		['', 'zwei', { maxChoices: 'form.error.limitInvalid' }],
		['', '1e1', { maxChoices: 'form.error.limitInvalid' }],
		['3', '2', { minChoices: 'form.error.limitOrder' }],
		['4', '', { minChoices: 'form.error.limitTooHigh' }],
		['', '4', { maxChoices: 'form.error.limitTooHigh' }],
		['5', '4', { minChoices: 'form.error.limitOrder', maxChoices: 'form.error.limitTooHigh' }],
	])('check the limits %j to %j for three options', (minChoices, maxChoices, errors) => {
		expect(validateDraft(textDraft({ minChoices, maxChoices }), today)).toEqual(errors);
	});

	it('compare the limits with the options only once there are options', () => {
		expect(validateDraft(textDraft({ texts: [], minChoices: '2' }), today)).toEqual({
			texts: 'form.error.optionsRequired',
		});
	});

	it('build a text poll with the options in order and the limits as numbers', () => {
		const ids = ['aaaaaaaa', 'aaaaaaaa', 'bbbbbbbb', 'cccccccc'];
		const poll = buildPoll(
			textDraft({
				texts: [{ text: ' Sushi ' }, { text: 'Pizza\tmit\u0000Oliven' }, { text: 'Curry' }],
				minChoices: '1',
				maxChoices: ' 2 ',
				days: [{ date: '2026-11-03', slots: [] }],
			}),
			() => ids.shift()!,
		);
		expect(poll).toEqual({
			v: 1,
			type: 'text',
			title: 'Grillabend',
			timezone: 'Europe/Zurich',
			allowMaybe: true,
			options: [
				{ id: 'aaaaaaaa', text: 'Sushi' },
				{ id: 'bbbbbbbb', text: 'Pizza mit Oliven' },
				{ id: 'cccccccc', text: 'Curry' },
			],
			minChoices: 1,
			maxChoices: 2,
		});
		expect(parsePoll(poll)).toEqual(poll);
	});

	it('leave out empty limits, and keep the IDs of existing options', () => {
		const poll = buildPoll(textDraft({ texts: [{ text: 'Pizza', id: '0a1b2c3d' }, { text: 'Sushi' }] }));
		expect(poll).not.toHaveProperty('minChoices');
		expect(poll).not.toHaveProperty('maxChoices');
		expect(poll.options[0]).toEqual({ id: '0a1b2c3d', text: 'Pizza' });
		expect(poll.options[1]?.id).not.toBe('0a1b2c3d');
	});

	it('are left out of a date poll', () => {
		const poll = buildPoll(draft({ texts: [{ text: 'Pizza' }], minChoices: '1' }));
		expect(poll.type).toBe('dates');
		expect(poll).not.toHaveProperty('minChoices');
		expect(dated(poll)).toHaveLength(1);
	});

	it('turn control characters into spaces', () => {
		expect(optionText(' a\tb\r\nc\u0085 ')).toBe('a b c');
		expect(optionText('Pizza\ud83e')).toBe('Pizza');
		expect(optionText('🦁 Löwe')).toBe('🦁 Löwe');
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
		type: 'dates',
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
			type: 'dates',
			title: 'Grillabend',
			description: 'Mit Salat',
			location: '',
			allowMaybe: false,
			texts: [],
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
		expect(dated(edited).find((option) => option.id === 'bbbbbbbb')?.end).toBe('2026-11-04T23:00');
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

	describe('a text poll', () => {
		const lunch: Poll = {
			v: 1,
			type: 'text',
			title: 'Mittagessen',
			location: 'Kantine',
			timezone: 'Europe/Zurich',
			options: [
				{ id: 'aaaaaaaa', text: 'Pizza' },
				{ id: 'bbbbbbbb', text: 'Sushi' },
				{ id: 'cccccccc', text: 'Curry' },
			],
			allowMaybe: true,
			minChoices: 1,
			maxChoices: 2,
			finalOptionId: 'cccccccc',
		};

		it('turns into a draft and back without changes', () => {
			const draft = draftFromPoll(lunch, expires);
			expect(draft).toMatchObject({
				type: 'text',
				title: 'Mittagessen',
				location: 'Kantine',
				days: [],
				texts: [
					{ id: 'aaaaaaaa', text: 'Pizza' },
					{ id: 'bbbbbbbb', text: 'Sushi' },
					{ id: 'cccccccc', text: 'Curry' },
				],
				minChoices: '1',
				maxChoices: '2',
				expiryDate: '2026-12-31',
			});
			expect(validateDraft(draft, today)).toEqual({});
			expect(editedPoll(lunch, draft)).toEqual(lunch);
		});

		it('keeps the IDs of options whose text or position changed, and takes new limits', () => {
			const draft = draftFromPoll(lunch, expires);
			draft.texts[0]!.text = 'Pizza Margherita';
			draft.texts.reverse();
			draft.texts.push({ text: 'Salat' });
			draft.minChoices = '';
			draft.maxChoices = '3';
			const edited = editedPoll(lunch, draft, () => 'dddddddd');
			expect(edited).toMatchObject({
				options: [
					{ id: 'cccccccc', text: 'Curry' },
					{ id: 'bbbbbbbb', text: 'Sushi' },
					{ id: 'aaaaaaaa', text: 'Pizza Margherita' },
					{ id: 'dddddddd', text: 'Salat' },
				],
				maxChoices: 3,
				finalOptionId: 'cccccccc',
			});
			expect(edited).not.toHaveProperty('minChoices');
			expect(removedOptions(lunch, edited)).toEqual([]);
		});

		it('reports removed options and drops a removed final option', () => {
			const draft = draftFromPoll(lunch, expires);
			draft.texts.splice(2, 1);
			const edited = editedPoll(lunch, draft);
			expect(removedOptions(lunch, edited)).toEqual([{ id: 'cccccccc', text: 'Curry' }]);
			expect(edited).not.toHaveProperty('finalOptionId');
		});

		it('turns a poll without limits into empty limit fields', () => {
			const { minChoices: _min, maxChoices: _max, ...unlimited } = lunch;
			expect(draftFromPoll(unlimited, expires)).toMatchObject({ minChoices: '', maxChoices: '' });
		});
	});

	it('never reuses an ID for a new option', () => {
		const draft = draftFromPoll(poll, expires);
		draft.days = toggleDay(draft.days, '2026-11-07');
		const ids = ['aaaaaaaa', 'ffffffff'];
		expect(editedPoll(poll, draft, () => ids.shift()!).options.at(-1)?.id).toBe('ffffffff');
	});
});
