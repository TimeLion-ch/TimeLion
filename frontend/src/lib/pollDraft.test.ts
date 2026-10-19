import { describe, expect, it } from 'vitest';
import { serverLimits } from './api';
import { parsePoll } from './model';
import {
	buildPoll,
	defaultExpiryDate,
	emptyDraft,
	expiresAt,
	maxExpiryDate,
	newOptionId,
	toggleDay,
	validateDraft,
	type PollDraft,
} from './pollDraft';

const today = '2026-10-19';

function draft(changes: Partial<PollDraft> = {}): PollDraft {
	return { ...emptyDraft('Europe/Zurich', today), title: 'Grillabend', days: [{ date: '2026-11-03' }], ...changes };
}

describe('toggleDay', () => {
	it('adds dates in order and removes them again', () => {
		let days = toggleDay([], '2026-11-05');
		days = toggleDay(days, '2026-11-03');
		days = toggleDay(days, '2026-11-04');
		expect(days.map((day) => day.date)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']);
		expect(toggleDay(days, '2026-11-04').map((day) => day.date)).toEqual(['2026-11-03', '2026-11-05']);
	});
});

describe('expiry', () => {
	it('defaults to 30 days after the last date', () => {
		expect(defaultExpiryDate([{ date: '2026-11-03' }, { date: '2026-12-01' }], today)).toBe('2026-12-31');
		expect(defaultExpiryDate([], today)).toBe('2026-11-18');
		expect(emptyDraft('UTC', today).expiryDate).toBe('2026-11-18');
	});

	it('is capped at the maximum lifetime', () => {
		expect(maxExpiryDate(today)).toBe('2027-10-18');
		expect(defaultExpiryDate([{ date: '2027-10-01' }], today)).toBe('2027-10-18');
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
		const days = Array.from({ length: 101 }, (_, index) => ({ date: `2027-01-01T${index}` }));
		expect(validateDraft(draft({ days }), today).days).toBe('form.error.tooManyOptions');
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
				days: [{ date: '2026-11-03' }, { date: '2026-11-04' }],
			}),
		);
		expect(parsePoll(poll)).toEqual(poll);
		expect(poll).toMatchObject({ v: 1, title: 'Grillabend', location: 'Bern', timezone: 'Europe/Zurich' });
		expect(poll).not.toHaveProperty('description');
		expect(poll.options.map((option) => option.start)).toEqual(['2026-11-03', '2026-11-04']);
	});

	it('gives every option a different ID', () => {
		const ids = ['aaaaaaaa', 'aaaaaaaa', 'bbbbbbbb'];
		const poll = buildPoll(draft({ days: [{ date: '2026-11-03' }, { date: '2026-11-04' }] }), () => ids.shift()!);
		expect(poll.options.map((option) => option.id)).toEqual(['aaaaaaaa', 'bbbbbbbb']);
	});
});

describe('newOptionId', () => {
	it('returns 8 lowercase hex characters', () => {
		expect(newOptionId()).toMatch(/^[0-9a-f]{8}$/);
	});
});
