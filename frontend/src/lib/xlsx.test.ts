import { describe, expect, it } from 'vitest';
import { buildXlsx, columnName, escapeXml } from './xlsx';

/** The files are stored uncompressed, so the archive's text holds every XML part as it is. */
function text(archive: Uint8Array): string {
	return new TextDecoder().decode(archive);
}

/** The worksheet's rows, without the XML around them. */
function sheetData(archive: Uint8Array): string {
	return /<sheetData>(.*)<\/sheetData>/.exec(text(archive))?.[1] ?? '';
}

describe('buildXlsx', () => {
	it('builds a workbook with the parts Excel needs', () => {
		const archive = buildXlsx([{ cells: ['Name'] }], 'Antworten');
		const parts = [
			'[Content_Types].xml',
			'_rels/.rels',
			'xl/workbook.xml',
			'xl/_rels/workbook.xml.rels',
			'xl/styles.xml',
			'xl/worksheets/sheet1.xml',
		];
		for (const part of parts) {
			expect(text(archive)).toContain(part);
		}
		expect(text(archive)).toContain('<sheet name="Antworten" sheetId="1" r:id="rId1"/>');
	});

	it('writes texts as inline strings, numbers as values, and headings in bold', () => {
		const archive = buildXlsx(
			[
				{ cells: ['Teilnehmende', 'Di., 3. Nov. 2026'], heading: true },
				{ cells: ['Ada', 'Ja'] },
				{ cells: ['Total Ja', 1] },
			],
			'Antworten',
		);
		expect(sheetData(archive)).toBe(
			'<row r="1">' +
				'<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Teilnehmende</t></is></c>' +
				'<c r="B1" t="inlineStr" s="1"><is><t xml:space="preserve">Di., 3. Nov. 2026</t></is></c>' +
				'</row>' +
				'<row r="2">' +
				'<c r="A2" t="inlineStr"><is><t xml:space="preserve">Ada</t></is></c>' +
				'<c r="B2" t="inlineStr"><is><t xml:space="preserve">Ja</t></is></c>' +
				'</row>' +
				'<row r="3">' +
				'<c r="A3" t="inlineStr"><is><t xml:space="preserve">Total Ja</t></is></c>' +
				'<c r="B3"><v>1</v></c>' +
				'</row>',
		);
	});

	it('leaves out empty cells and rows, and keeps the row numbers', () => {
		const data = sheetData(
			buildXlsx([{ cells: ['Ada', '', 'Ja'] }, { cells: [] }, { cells: ['Kommentare'] }], 'x'),
		);
		expect(data).toContain('<c r="C1" t="inlineStr">');
		expect(data).not.toContain('r="B1"');
		expect(data).not.toContain('<row r="2"');
		expect(data).toContain('<row r="3"><c r="A3"');
	});

	it('escapes texts, which can never become formulas', () => {
		const data = sheetData(buildXlsx([{ cells: ['=HYPERLINK("http://x")', '<b>&</b>'] }], 'x'));
		expect(data).toContain('<t xml:space="preserve">=HYPERLINK(&quot;http://x&quot;)</t>');
		expect(data).toContain('<t xml:space="preserve">&lt;b&gt;&amp;&lt;/b&gt;</t>');
		expect(data).not.toContain('<f>');
	});

	it('makes every column wide enough for dates, and the first for names', () => {
		const archive = buildXlsx([{ cells: ['Name', 'a', 'b', 'c'] }], 'x');
		expect(text(archive)).toContain(
			'<cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="4" width="18" customWidth="1"/></cols>',
		);
	});
});

describe('columnName', () => {
	it('counts like Excel', () => {
		expect([0, 1, 25, 26, 27, 51, 52, 100, 701, 702].map(columnName)).toEqual([
			'A',
			'B',
			'Z',
			'AA',
			'AB',
			'AZ',
			'BA',
			'CW',
			'ZZ',
			'AAA',
		]);
	});
});

describe('escapeXml', () => {
	it('escapes the special characters', () => {
		expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
			`&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry's&lt;/a&gt;`,
		);
	});

	it('drops what XML cannot hold, and keeps tabs, line breaks and emoji', () => {
		const nonCharacter = String.fromCharCode(0xfffe);
		expect(escapeXml(`a\u0000b\u0007c\u001bd${nonCharacter}e\ud800f\tg\nh\r\ni🦁`)).toBe('abcdef\tg\nh\r\ni🦁');
	});
});
