/**
 * Locale-aware formatting with `Intl.DateTimeFormat` (no date library). Option dates and times are wall-clock values
 * in the poll's timezone (model.ts), so they are formatted as UTC, which leaves them exactly as written.
 */

import { addDays, dateToUtc } from './dates';
import type { Locale } from './i18n';
import type { PollOption } from './model';

/** Swiss German for German; British English for English: a 24-hour clock and the day before the month. */
const intlLocales: Record<Locale, string> = { de: 'de-CH', en: 'en-GB' };

export function intlLocale(locale: Locale): string {
	return intlLocales[locale];
}

/** `compact`: "Di., 3. Nov."; `short`: "Di., 3. Nov. 2026"; `long`: "Dienstag, 3. November 2026". */
export type DateStyle = 'compact' | 'short' | 'long';

function dateOptions(style: DateStyle): Intl.DateTimeFormatOptions {
	const options: Intl.DateTimeFormatOptions = {
		timeZone: 'UTC',
		weekday: style === 'long' ? 'long' : 'short',
		day: 'numeric',
		month: style === 'long' ? 'long' : 'short',
	};
	if (style !== 'compact') {
		options.year = 'numeric';
	}
	return options;
}

export function formatDate(date: string, locale: Locale, style: DateStyle = 'short'): string {
	return new Intl.DateTimeFormat(intlLocales[locale], dateOptions(style)).format(dateToUtc(date));
}

/** "November 2026" */
export function formatMonth(month: string, locale: Locale): string {
	return new Intl.DateTimeFormat(intlLocales[locale], { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
		dateToUtc(`${month}-01`),
	);
}

/** Monday first. */
export function weekdayNames(locale: Locale, style: 'narrow' | 'short' | 'long'): string[] {
	const format = new Intl.DateTimeFormat(intlLocales[locale], { timeZone: 'UTC', weekday: style });
	// 2024-01-01 was a Monday.
	return Array.from({ length: 7 }, (_, index) => format.format(dateToUtc(addDays('2024-01-01', index))));
}

/** A Unix timestamp as a date in the browser's timezone, e.g. "3. November 2026". */
export function formatTimestamp(seconds: number, locale: Locale): string {
	return new Intl.DateTimeFormat(intlLocales[locale], { day: 'numeric', month: 'long', year: 'numeric' }).format(
		seconds * 1000,
	);
}

export type FormattedOption = {
	date: string;
	/** Null for whole days. */
	time: string | null;
};

export function formatOption(option: PollOption, locale: Locale, style: DateStyle = 'short'): FormattedOption {
	const tag = intlLocales[locale];
	const [startDate = '', startTime] = option.start.split('T');
	const [endDate = '', endTime] = option.end?.split('T') ?? [];

	if (startTime === undefined) {
		if (option.end === undefined) {
			return { date: formatDate(startDate, locale, style), time: null };
		}
		const range = new Intl.DateTimeFormat(tag, dateOptions(style));
		return { date: range.formatRange(dateToUtc(startDate), dateToUtc(endDate)), time: null };
	}

	const date = formatDate(startDate, locale, style);
	const at = (day: string, time: string) => dateToUtc(day) + minutes(time) * 60_000;
	if (endTime === undefined) {
		return { date, time: formatTime(startTime, locale) };
	}
	const sameDay = endDate === startDate;
	const range = new Intl.DateTimeFormat(tag, {
		timeZone: 'UTC',
		hour: '2-digit',
		minute: '2-digit',
		...(sameDay ? {} : { weekday: 'short' }),
	});
	return { date, time: range.formatRange(at(startDate, startTime), at(endDate, endTime)) };
}

/** One line, e.g. for labels: "Di., 3. Nov. 2026, 18:00–22:00". */
export function optionLabel(option: PollOption, locale: Locale, style: DateStyle = 'short'): string {
	const { date, time } = formatOption(option, locale, style);
	return time === null ? date : `${date}, ${time}`;
}

/** `HH:MM` in the locale's clock. */
export function formatTime(time: string, locale: Locale): string {
	return new Intl.DateTimeFormat(intlLocales[locale], { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }).format(
		minutes(time) * 60_000,
	);
}

function minutes(time: string): number {
	const [hours = 0, mins = 0] = time.split(':').map(Number);
	return hours * 60 + mins;
}
