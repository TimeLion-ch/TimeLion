import { describe, expect, it } from 'vitest';
import { formatDate, formatMonth, formatOption, formatTime, optionLabel, weekdayNames } from './format';

// ICU may use narrow or thin spaces; compare with plain spaces.
const plain = (text: string) => text.replace(/[   ]/g, ' ');

describe('formatDate and formatMonth', () => {
	it('formats dates without a timezone shift', () => {
		expect(plain(formatDate('2026-11-03', 'de'))).toBe('Di., 3. Nov. 2026');
		expect(plain(formatDate('2026-11-03', 'de', 'long'))).toBe('Dienstag, 3. November 2026');
		expect(plain(formatDate('2026-11-03', 'en'))).toContain('3 Nov 2026');
		expect(plain(formatMonth('2026-11', 'de'))).toBe('November 2026');
		expect(plain(formatMonth('2027-01', 'en'))).toBe('January 2027');
	});

	it('lists weekdays from Monday', () => {
		expect(weekdayNames('de', 'short')[0]).toBe('Mo');
		expect(weekdayNames('en', 'long')).toEqual([
			'Monday',
			'Tuesday',
			'Wednesday',
			'Thursday',
			'Friday',
			'Saturday',
			'Sunday',
		]);
	});
});

describe('formatOption', () => {
	it('formats a whole day', () => {
		expect(formatOption({ id: '00000000', start: '2026-11-03' }, 'de')).toEqual({
			date: formatDate('2026-11-03', 'de'),
			time: null,
		});
	});

	it('formats several whole days as a range', () => {
		const { date, time } = formatOption({ id: '00000000', start: '2026-11-03', end: '2026-11-05' }, 'en');
		expect(plain(date)).toMatch(/3.*5 Nov/);
		expect(time).toBeNull();
	});

	it('formats a start time and a time range on one day', () => {
		expect(formatOption({ id: '00000000', start: '2026-11-03T09:05' }, 'de').time).toBe('09:05');
		const { date, time } = formatOption(
			{ id: '00000000', start: '2026-11-03T18:00', end: '2026-11-03T22:30' },
			'en',
		);
		expect(plain(date)).toContain('3 Nov 2026');
		expect(plain(time ?? '')).toMatch(/^18:00 ?– ?22:30$/);
	});

	it('names the weekday of an end on another day', () => {
		const { time } = formatOption({ id: '00000000', start: '2026-11-03T22:00', end: '2026-11-04T01:00' }, 'en');
		expect(time).toContain('Tue');
		expect(time).toContain('Wed');
		expect(time).toContain('01:00');
	});

	it('joins date and time into one label', () => {
		expect(plain(optionLabel({ id: '00000000', start: '2026-11-03T18:00' }, 'de'))).toBe(
			'Di., 3. Nov. 2026, 18:00',
		);
		expect(plain(optionLabel({ id: '00000000', start: '2026-11-03' }, 'de'))).toBe('Di., 3. Nov. 2026');
	});

	it('formats times with a 24-hour clock', () => {
		expect(formatTime('00:00', 'en')).toBe('00:00');
		expect(formatTime('23:59', 'de')).toBe('23:59');
	});
});
