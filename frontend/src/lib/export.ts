/**
 * The results of a poll as a sheet, for a CSV file or an Excel workbook (xlsx.ts) built in the browser: the options as
 * columns, a row per response with its votes, the totals, and the comments below. Like the calendar file, it holds the
 * poll's texts but never its link.
 */

import { optionLabel } from './format';
import type { Locale, Params } from './i18n';
import type { MessageKey } from './i18n.svelte';
import type { Poll, PollResponse } from './model';
import { hasTimes, tally } from './results';

export type Cell = string | number;

/** A heading is bold in Excel. A row without cells separates the parts. */
export type Row = { cells: Cell[]; heading?: true };

export function resultSheet(
	poll: Poll,
	responses: readonly PollResponse[],
	locale: Locale,
	t: (key: MessageKey, params?: Params) => string,
): Row[] {
	const rows: Row[] = [
		{
			cells: [t('results.participant'), ...poll.options.map((option) => optionLabel(option, locale))],
			heading: true,
		},
	];
	for (const response of responses) {
		const votes = poll.options.map((option) => {
			const vote = Object.hasOwn(response.votes, option.id) ? response.votes[option.id] : undefined;
			return vote === undefined ? '' : t(`vote.${vote}`);
		});
		rows.push({ cells: [response.name, ...votes] });
	}

	const tallies = tally(poll, responses);
	rows.push({ cells: [t('results.yesTotal'), ...poll.options.map((option) => tallies.get(option.id)?.yes ?? 0)] });
	if (poll.allowMaybe) {
		rows.push({
			cells: [t('results.maybeTotal'), ...poll.options.map((option) => tallies.get(option.id)?.maybe ?? 0)],
		});
	}
	if (hasTimes(poll)) {
		rows.push({ cells: [] }, { cells: [t('poll.timezone', { zone: poll.timezone.replaceAll('_', ' ') })] });
	}

	const comments = responses.filter((response) => response.comment);
	if (comments.length > 0) {
		rows.push({ cells: [] }, { cells: [t('results.comments')], heading: true });
		for (const response of comments) {
			rows.push({ cells: [response.name, response.comment ?? ''] });
		}
	}
	return rows;
}

/**
 * CSV (RFC 4180) with a byte order mark, so that Excel reads it as UTF-8. Names and comments come from whoever has the
 * link, so a text that a spreadsheet would run as a formula gets an apostrophe in front (OWASP: CSV injection).
 */
export function toCsv(rows: readonly Row[]): string {
	return '﻿' + rows.map((row) => row.cells.map(csvField).join(',') + '\r\n').join('');
}

function csvField(cell: Cell): string {
	if (typeof cell === 'number') {
		return String(cell);
	}
	const text = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
