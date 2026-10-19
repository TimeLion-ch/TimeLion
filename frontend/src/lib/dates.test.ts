import { describe, expect, it } from 'vitest';
import { addDays, addMonths, isoDate, monthGrid, todayIn, weekday, zonedToUtc } from './dates';

describe('date arithmetic', () => {
	it('normalises overflowing parts', () => {
		expect(isoDate(2026, 13, 1)).toBe('2027-01-01');
		expect(isoDate(2026, 3, 0)).toBe('2026-02-28');
		expect(isoDate(2028, 3, 0)).toBe('2028-02-29');
	});

	it('adds days across months, years and DST changes', () => {
		expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
		expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
		expect(addDays('2026-01-01', 365)).toBe('2027-01-01');
	});

	it('adds months to dates and months', () => {
		expect(addMonths('2026-12', 1)).toBe('2027-01');
		expect(addMonths('2026-01-31', -1)).toBe('2025-12');
		expect(addMonths('2026-05', 12)).toBe('2027-05');
	});

	it('numbers weekdays from Monday', () => {
		expect(weekday('2026-10-19')).toBe(0);
		expect(weekday('2026-10-25')).toBe(6);
	});
});

describe('monthGrid', () => {
	it('lays out a month in weeks starting on Monday', () => {
		const weeks = monthGrid('2026-11');
		// 1 November 2026 is a Sunday.
		expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
		expect(weeks.at(-1)).toEqual(['2026-11-30', null, null, null, null, null, null]);
		expect(weeks.flat().filter((date) => date !== null)).toHaveLength(30);
		expect(weeks.every((week) => week.length === 7)).toBe(true);
	});

	it('handles a month that starts on Monday and leap years', () => {
		expect(monthGrid('2027-02')[0]?.[0]).toBe('2027-02-01');
		expect(
			monthGrid('2028-02')
				.flat()
				.filter((date) => date !== null),
		).toHaveLength(29);
	});
});

describe('todayIn', () => {
	it('uses the wall clock of the timezone', () => {
		const instant = new Date('2026-10-19T23:30:00Z');
		expect(todayIn('UTC', instant)).toBe('2026-10-19');
		expect(todayIn('Europe/Zurich', instant)).toBe('2026-10-20');
		expect(todayIn('America/New_York', instant)).toBe('2026-10-19');
	});
});

describe('zonedToUtc', () => {
	it('converts wall-clock times to instants, with and without DST', () => {
		expect(new Date(zonedToUtc('2026-11-04', '18:00', 'Europe/Zurich')).toISOString()).toBe(
			'2026-11-04T17:00:00.000Z',
		);
		expect(new Date(zonedToUtc('2026-07-01', '12:00', 'Europe/Zurich')).toISOString()).toBe(
			'2026-07-01T10:00:00.000Z',
		);
		expect(new Date(zonedToUtc('2026-07-01', '00:00', 'America/Los_Angeles')).toISOString()).toBe(
			'2026-07-01T07:00:00.000Z',
		);
		expect(new Date(zonedToUtc('2026-07-01', '09:30', 'Asia/Kolkata')).toISOString()).toBe(
			'2026-07-01T04:00:00.000Z',
		);
	});

	it('gives times around a DST change a neighbouring instant', () => {
		// 02:30 doesn't exist in Zurich on 29 March 2026 and exists twice on 25 October 2026.
		const skipped = zonedToUtc('2026-03-29', '02:30', 'Europe/Zurich');
		expect([Date.parse('2026-03-29T00:30:00Z'), Date.parse('2026-03-29T01:30:00Z')]).toContain(skipped);
		const repeated = zonedToUtc('2026-10-25', '02:30', 'Europe/Zurich');
		expect([Date.parse('2026-10-25T00:30:00Z'), Date.parse('2026-10-25T01:30:00Z')]).toContain(repeated);
	});
});
