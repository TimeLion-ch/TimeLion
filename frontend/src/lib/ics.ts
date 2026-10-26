/**
 * An iCalendar file (RFC 5545) for one option of a date poll, built in the browser.
 *
 * Whole days are `VALUE=DATE` events, which every calendar shows on that day wherever it is. Times are wall-clock
 * values in the poll's timezone (model.ts); they are converted to UTC (`…Z`), which is exact and needs no VTIMEZONE.
 * The file holds the poll's texts but never its link, which contains the key.
 */

import { addDays, zonedToUtc } from './dates';
import type { DateOption, DatePoll } from './model';

export type IcsContext = {
	/** Makes the UID stable, so that importing the file again updates the event. */
	pollId: string;
	/** The site's host name, for the UID. */
	host: string;
	/** Milliseconds, for DTSTAMP. */
	now: number;
};

export function buildIcs(poll: DatePoll, option: DateOption, context: IcsContext): string {
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//TimeLion//TimeLion//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${option.id}-${context.pollId}@${context.host}`,
		`DTSTAMP:${utc(context.now)}`,
		...times(poll, option),
		`SUMMARY:${escapeText(poll.title)}`,
	];
	if (poll.description !== undefined && poll.description.trim() !== '') {
		lines.push(`DESCRIPTION:${escapeText(poll.description)}`);
	}
	if (poll.location !== undefined && poll.location.trim() !== '') {
		lines.push(`LOCATION:${escapeText(poll.location)}`);
	}
	lines.push('END:VEVENT', 'END:VCALENDAR');
	return lines.map(fold).join('\r\n') + '\r\n';
}

function times(poll: DatePoll, option: DateOption): string[] {
	const [startDate = '', startTime] = option.start.split('T');
	if (startTime === undefined) {
		// DTEND of a date is exclusive: the day after the (inclusive) last day.
		const last = option.end ?? startDate;
		return [`DTSTART;VALUE=DATE:${compact(startDate)}`, `DTEND;VALUE=DATE:${compact(addDays(last, 1))}`];
	}
	const lines = [`DTSTART:${utc(zonedToUtc(startDate, startTime, poll.timezone))}`];
	if (option.end !== undefined) {
		const [endDate = '', endTime = '00:00'] = option.end.split('T');
		lines.push(`DTEND:${utc(zonedToUtc(endDate, endTime, poll.timezone))}`);
	}
	return lines;
}

/** `YYYY-MM-DD` → `YYYYMMDD` */
function compact(date: string): string {
	return date.replaceAll('-', '');
}

/** Milliseconds → `YYYYMMDDTHHMMSSZ` */
function utc(ms: number): string {
	return new Date(ms)
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

/**
 * TEXT values (RFC 5545, 3.3.11): backslash, semicolon and comma escaped, line breaks as `\n`. Other control characters
 * can't be in TEXT, so they are dropped: a poll's texts come from whoever has the link.
 */
export function escapeText(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r\n?|\n/g, '\\n')
		.replace(/[\u0000-\u0008\u000a-\u001f\u007f]/g, '');
}

/** Lines longer than 75 octets continue on the next line after a space (3.1); UTF-8 characters stay whole. */
export function fold(line: string): string {
	const encoder = new TextEncoder();
	const parts: string[] = [];
	let current = '';
	let size = 0;
	for (const character of line) {
		const length = encoder.encode(character).length;
		// Continuation lines start with a space, which counts too.
		if (size + length > (parts.length === 0 ? 75 : 74)) {
			parts.push(current);
			current = '';
			size = 0;
		}
		current += character;
		size += length;
	}
	parts.push(current);
	return parts.join('\r\n ');
}
