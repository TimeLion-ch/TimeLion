import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, fold, icsFilename } from './ics';
import type { Poll } from './model';

const poll: Poll = {
	v: 1,
	title: 'Grillabend; Team, Bern',
	description: 'Bring etwas mit.\nDanke!',
	location: 'Aare\\Ufer',
	timezone: 'Europe/Zurich',
	options: [
		{ id: 'aaaaaaaa', start: '2026-11-03' },
		{ id: 'bbbbbbbb', start: '2026-11-04T18:00', end: '2026-11-04T22:30' },
		{ id: 'cccccccc', start: '2026-07-01T22:00', end: '2026-07-02T01:00' },
		{ id: 'dddddddd', start: '2026-12-30', end: '2027-01-02' },
		{ id: 'eeeeeeee', start: '2026-11-05T09:00' },
	],
	allowMaybe: true,
};

const context = {
	pollId: '0123456789abcdef0123456789abcdef',
	host: 'timelion.ch',
	now: Date.UTC(2026, 9, 19, 8, 5, 9),
};

function lines(optionIndex: number, source: Poll = poll): string[] {
	return buildIcs(source, source.options[optionIndex]!, context).split('\r\n');
}

describe('buildIcs', () => {
	it('builds a calendar with one event and CRLF line ends', () => {
		const ics = buildIcs(poll, poll.options[0]!, context);
		expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
		expect(ics.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
		expect(lines(0)).toEqual([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//TimeLion//TimeLion//EN',
			'CALSCALE:GREGORIAN',
			'METHOD:PUBLISH',
			'BEGIN:VEVENT',
			'UID:aaaaaaaa-0123456789abcdef0123456789abcdef@timelion.ch',
			'DTSTAMP:20261019T080509Z',
			'DTSTART;VALUE=DATE:20261103',
			'DTEND;VALUE=DATE:20261104',
			'SUMMARY:Grillabend\\; Team\\, Bern',
			'DESCRIPTION:Bring etwas mit.\\nDanke!',
			'LOCATION:Aare\\\\Ufer',
			'END:VEVENT',
			'END:VCALENDAR',
			'',
		]);
	});

	it('converts times in the poll timezone to UTC, in winter and summer', () => {
		expect(lines(1)).toContain('DTSTART:20261104T170000Z');
		expect(lines(1)).toContain('DTEND:20261104T213000Z');
		expect(lines(2)).toContain('DTSTART:20260701T200000Z');
		expect(lines(2)).toContain('DTEND:20260701T230000Z');
		expect(lines(1, { ...poll, timezone: 'America/New_York' })).toContain('DTSTART:20261104T230000Z');
	});

	it('ends several whole days the day after the last one', () => {
		expect(lines(3)).toContain('DTSTART;VALUE=DATE:20261230');
		expect(lines(3)).toContain('DTEND;VALUE=DATE:20270103');
	});

	it('leaves out the end of an option without one, and empty texts', () => {
		const { location: _, ...withoutLocation } = poll;
		const event = lines(4, { ...withoutLocation, description: ' ' });
		expect(event).toContain('DTSTART:20261105T080000Z');
		expect(event.some((line) => line.startsWith('DTEND'))).toBe(false);
		expect(event.some((line) => line.startsWith('DESCRIPTION') || line.startsWith('LOCATION'))).toBe(false);
	});
});

describe('escapeText', () => {
	it('escapes the special characters of TEXT values', () => {
		expect(escapeText('a\\b;c,d\r\ne\nf\rg')).toBe('a\\\\b\\;c\\,d\\ne\\nf\\ng');
	});
});

describe('fold', () => {
	it('keeps short lines', () => {
		expect(fold('SUMMARY:kurz')).toBe('SUMMARY:kurz');
	});

	it('folds at 75 octets without splitting UTF-8 characters', () => {
		const line = `SUMMARY:${'ä'.repeat(100)}`;
		const folded = fold(line);
		const parts = folded.split('\r\n');
		expect(parts.length).toBeGreaterThan(1);
		for (const part of parts) {
			expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
		}
		expect(parts.slice(1).every((part) => part.startsWith(' '))).toBe(true);
		expect(folded.replaceAll('\r\n ', '')).toBe(line);
	});

	it('keeps emoji whole', () => {
		const line = `SUMMARY:${'🦁'.repeat(40)}`;
		expect(fold(line).replaceAll('\r\n ', '')).toBe(line);
		expect(fold(line)).not.toMatch(/�/);
	});
});

describe('icsFilename', () => {
	it('makes a safe file name', () => {
		expect(icsFilename('Grillabend: Team/Bern 2026')).toBe('Grillabend-TeamBern-2026.ics');
		expect(icsFilename('Zoë’s Fest')).toBe('Zoës-Fest.ics');
		expect(icsFilename('../../')).toBe('timelion.ics');
	});
});
