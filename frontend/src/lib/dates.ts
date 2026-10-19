/**
 * Calendar dates as `YYYY-MM-DD` strings and months as `YYYY-MM`, the forms the poll model uses (model.ts).
 *
 * Date arithmetic runs on UTC timestamps, so the browser's own timezone and its DST changes can't shift a date. Only
 * `todayIn` and `zonedToUtc` look at a real timezone, through `Intl` (no date library). Weeks start on Monday.
 */

const DAY_MS = 86_400_000;

/** Normalises overflow, so `isoDate(2026, 13, 0)` is `2026-12-31`. */
export function isoDate(year: number, month: number, day: number): string {
	return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

/** Milliseconds of the date's midnight in UTC. */
export function dateToUtc(date: string): number {
	const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
	return Date.UTC(year, month - 1, day);
}

export function addDays(date: string, days: number): string {
	return new Date(dateToUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The month of a date or month string, moved by `months`. */
export function addMonths(month: string, months: number): string {
	const [year = 0, number = 1] = month.split('-').map(Number);
	return isoDate(year, number + months, 1).slice(0, 7);
}

export function monthOf(date: string): string {
	return date.slice(0, 7);
}

/** 0 for Monday to 6 for Sunday. */
export function weekday(date: string): number {
	return (new Date(dateToUtc(date)).getUTCDay() + 6) % 7;
}

/** The month as weeks of seven dates, Monday first; days of the neighbouring months are null. */
export function monthGrid(month: string): (string | null)[][] {
	const first = `${month}-01`;
	const length = Number(addDays(addMonths(month, 1) + '-01', -1).slice(8));
	const cells: (string | null)[] = Array.from({ length: weekday(first) }, () => null);
	for (let day = 1; day <= length; day++) {
		cells.push(addDays(first, day - 1));
	}
	while (cells.length % 7 !== 0) {
		cells.push(null);
	}
	const weeks: (string | null)[][] = [];
	for (let start = 0; start < cells.length; start += 7) {
		weeks.push(cells.slice(start, start + 7));
	}
	return weeks;
}

/** The date the wall clock in `timeZone` shows at `now`. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
	const parts = wallClock(now.getTime(), timeZone);
	return isoDate(parts.year, parts.month, parts.day);
}

/** The browser's IANA timezone, or UTC if it has none. */
export function browserTimeZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	} catch {
		return 'UTC';
	}
}

/**
 * The instant (milliseconds) at which the wall clock in `timeZone` shows `date` and `time` (`HH:MM`). A time that a
 * DST change skips or repeats gets one of its neighbouring instants.
 */
export function zonedToUtc(date: string, time: string, timeZone: string): number {
	const [hours = 0, minutes = 0] = time.split(':').map(Number);
	const local = dateToUtc(date) + (hours * 60 + minutes) * 60_000;
	let instant = local - offset(local, timeZone);
	const corrected = local - offset(instant, timeZone);
	if (corrected !== instant) {
		instant = corrected;
	}
	return instant;
}

/** How far the wall clock in `timeZone` is ahead of UTC at the instant `ms`. */
function offset(ms: number, timeZone: string): number {
	const parts = wallClock(ms, timeZone);
	const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
	return asUtc - Math.floor(ms / 1000) * 1000;
}

function wallClock(ms: number, timeZone: string) {
	const format = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
	});
	const values: Record<string, number> = {};
	for (const part of format.formatToParts(new Date(ms))) {
		values[part.type] = Number(part.value);
	}
	return {
		year: values['year'] ?? 1970,
		month: values['month'] ?? 1,
		day: values['day'] ?? 1,
		hour: values['hour'] ?? 0,
		minute: values['minute'] ?? 0,
		second: values['second'] ?? 0,
	};
}
