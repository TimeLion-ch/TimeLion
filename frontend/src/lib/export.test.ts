import { describe, expect, it } from 'vitest';
import de from '../locales/de.json';
import en from '../locales/en.json';
import { resultSheet, toCsv, type Row } from './export';
import { translate, type Params } from './i18n';
import type { MessageKey } from './i18n.svelte';
import type { DatePoll, PollResponse, TextPoll } from './model';

const tEn = (key: MessageKey, params?: Params) => translate(en, de, key, params);
const tDe = (key: MessageKey, params?: Params) => translate(de, de, key, params);

const datePoll: DatePoll = {
	v: 1,
	type: 'dates',
	title: 'Grillabend',
	timezone: 'America/New_York',
	options: [
		{ id: 'aaaaaaaa', start: '2026-11-03' },
		{ id: 'bbbbbbbb', start: '2026-11-04T18:00', end: '2026-11-04T22:00' },
	],
	allowMaybe: true,
};

const textPoll: TextPoll = {
	v: 1,
	type: 'text',
	title: 'Lunch',
	timezone: 'Europe/Zurich',
	options: [
		{ id: 'aaaaaaaa', text: 'Pizza' },
		{ id: 'bbbbbbbb', text: 'Sushi' },
	],
	allowMaybe: false,
};

const responses: PollResponse[] = [
	{ v: 1, name: 'Ada', votes: { aaaaaaaa: 'yes', bbbbbbbb: 'maybe' }, comment: 'Ich bringe Salat.\nBis dann!' },
	{ v: 1, name: 'Grace', votes: { bbbbbbbb: 'no' } },
	{ v: 1, name: 'Linus', votes: { aaaaaaaa: 'yes', bbbbbbbb: 'yes' }, comment: '' },
];

describe('resultSheet', () => {
	it('lists the options, each response with its votes, the totals, the time zone and the comments', () => {
		expect(resultSheet(datePoll, responses, 'en', tEn)).toEqual([
			{ cells: ['Participant', 'Tue, 3 Nov 2026', 'Wed, 4 Nov 2026, 18:00–22:00'], heading: true },
			{ cells: ['Ada', 'Yes', 'Maybe'] },
			{ cells: ['Grace', '', 'No'] },
			{ cells: ['Linus', 'Yes', 'Yes'] },
			{ cells: ['Total yes', 2, 1] },
			{ cells: ['Total maybe', 0, 1] },
			{ cells: [] },
			{ cells: ['Times in America/New York'] },
			{ cells: [] },
			{ cells: ['Comments'], heading: true },
			{ cells: ['Ada', 'Ich bringe Salat.\nBis dann!'] },
		]);
	});

	it('uses the language of the page', () => {
		const sheet = resultSheet(datePoll, responses, 'de', tDe);
		expect(sheet[0]?.cells).toEqual(['Teilnehmende', 'Di., 3. Nov. 2026', 'Mi., 4. Nov. 2026, 18:00–22:00 Uhr']);
		expect(sheet[1]?.cells).toEqual(['Ada', 'Ja', 'Vielleicht']);
	});

	it('leaves out the maybe total without maybe, and the time zone and comments when there are none', () => {
		expect(resultSheet(textPoll, [{ v: 1, name: 'Ada', votes: { bbbbbbbb: 'yes' } }], 'en', tEn)).toEqual([
			{ cells: ['Participant', 'Pizza', 'Sushi'], heading: true },
			{ cells: ['Ada', '', 'Yes'] },
			{ cells: ['Total yes', 0, 1] },
		]);
	});

	it('lists the options and totals of a poll without responses', () => {
		expect(resultSheet(textPoll, [], 'en', tEn)).toEqual([
			{ cells: ['Participant', 'Pizza', 'Sushi'], heading: true },
			{ cells: ['Total yes', 0, 0] },
		]);
	});
});

describe('toCsv', () => {
	it('writes UTF-8 with a byte order mark, commas and CRLF line ends', () => {
		const rows: Row[] = [{ cells: ['Teilnehmende', 'Zürich 🦁'], heading: true }, { cells: ['Total Ja', 2] }];
		expect(toCsv(rows)).toBe('﻿Teilnehmende,Zürich 🦁\r\nTotal Ja,2\r\n');
	});

	it('quotes fields with commas, quotes or line breaks', () => {
		expect(toCsv([{ cells: ['Di., 3. Nov.', 'Sie sagte "ja"', 'a\nb', 'a\r\nb'] }])).toBe(
			'﻿"Di., 3. Nov.","Sie sagte ""ja""","a\nb","a\r\nb"\r\n',
		);
	});

	it('writes an empty row as an empty line', () => {
		expect(toCsv([{ cells: ['a'] }, { cells: [] }, { cells: ['b'] }])).toBe('﻿a\r\n\r\nb\r\n');
	});

	it('keeps texts that look like formulas from running', () => {
		const cells = ['=1+1', '+41 79', '-5', '@SUM(A1)', '\tx', '\rx', '=HYPERLINK("http://x","y")', 'a=b'];
		expect(toCsv([{ cells }])).toBe(
			'﻿\'=1+1,\'+41 79,\'-5,\'@SUM(A1),\'\tx,"\'\rx","\'=HYPERLINK(""http://x"",""y"")",a=b\r\n',
		);
	});

	it('writes numbers as they are', () => {
		expect(toCsv([{ cells: [0, 12] }])).toBe('﻿0,12\r\n');
	});
});
