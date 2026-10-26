/**
 * An Excel workbook (Office Open XML, ECMA-376) with one sheet, built in the browser without a library: the few XML
 * parts Excel needs, in a ZIP archive. Texts are inline strings, which Excel never runs as formulas.
 */

import type { Cell, Row } from './export';
import { zip } from './zip';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RELATIONSHIPS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE_RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml';

const CONTENT_TYPES =
	`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
	`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
	`<Default Extension="xml" ContentType="application/xml"/>` +
	`<Override PartName="/xl/workbook.xml" ContentType="${CONTENT_TYPE}.sheet.main+xml"/>` +
	`<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${CONTENT_TYPE}.worksheet+xml"/>` +
	`<Override PartName="/xl/styles.xml" ContentType="${CONTENT_TYPE}.styles+xml"/>` +
	`</Types>`;

const PACKAGE_RELATIONSHIPS =
	`${XML}<Relationships xmlns="${RELATIONSHIPS}">` +
	`<Relationship Id="rId1" Type="${OFFICE_RELATIONSHIPS}/officeDocument" Target="xl/workbook.xml"/>` +
	`</Relationships>`;

const WORKBOOK_RELATIONSHIPS =
	`${XML}<Relationships xmlns="${RELATIONSHIPS}">` +
	`<Relationship Id="rId1" Type="${OFFICE_RELATIONSHIPS}/worksheet" Target="worksheets/sheet1.xml"/>` +
	`<Relationship Id="rId2" Type="${OFFICE_RELATIONSHIPS}/styles" Target="styles.xml"/>` +
	`</Relationships>`;

/** Style 0 is the default; style 1, for headings, is bold and wraps long option texts. */
const STYLES =
	`${XML}<styleSheet xmlns="${MAIN}">` +
	`<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>` +
	`<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
	`<fills count="2"><fill><patternFill patternType="none"/></fill>` +
	`<fill><patternFill patternType="gray125"/></fill></fills>` +
	`<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
	`<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
	`<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
	`<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">` +
	`<alignment vertical="top" wrapText="1"/></xf></cellXfs>` +
	`<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
	`</styleSheet>`;

/** `sheetName` must be a valid sheet name: at most 31 characters, none of `: \ / ? * [ ]`. */
export function buildXlsx(rows: readonly Row[], sheetName: string): Uint8Array<ArrayBuffer> {
	const workbook =
		`${XML}<workbook xmlns="${MAIN}" xmlns:r="${OFFICE_RELATIONSHIPS}">` +
		`<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
	const encoder = new TextEncoder();
	const parts: [string, string][] = [
		['[Content_Types].xml', CONTENT_TYPES],
		['_rels/.rels', PACKAGE_RELATIONSHIPS],
		['xl/workbook.xml', workbook],
		['xl/_rels/workbook.xml.rels', WORKBOOK_RELATIONSHIPS],
		['xl/styles.xml', STYLES],
		['xl/worksheets/sheet1.xml', worksheet(rows)],
	];
	return zip(parts.map(([name, xml]) => ({ name, data: encoder.encode(xml) })));
}

/** The first column holds names, the others options; empty cells and rows are left out. */
function worksheet(rows: readonly Row[]): string {
	const columns = Math.max(2, ...rows.map((row) => row.cells.length));
	const data = rows
		.map((row, index) => {
			const cells = row.cells
				.map((cell, column) =>
					cell === '' ? '' : xmlCell(`${columnName(column)}${index + 1}`, cell, row.heading),
				)
				.join('');
			return cells === '' ? '' : `<row r="${index + 1}">${cells}</row>`;
		})
		.join('');
	return (
		`${XML}<worksheet xmlns="${MAIN}">` +
		`<cols><col min="1" max="1" width="30" customWidth="1"/>` +
		`<col min="2" max="${columns}" width="18" customWidth="1"/></cols>` +
		`<sheetData>${data}</sheetData></worksheet>`
	);
}

function xmlCell(reference: string, cell: Cell, heading: boolean | undefined): string {
	const style = heading === true ? ' s="1"' : '';
	if (typeof cell === 'number') {
		return `<c r="${reference}"${style}><v>${cell}</v></c>`;
	}
	return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
}

/** 0 → A, 25 → Z, 26 → AA */
export function columnName(index: number): string {
	let name = '';
	for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
		name = String.fromCharCode(65 + ((rest - 1) % 26)) + name;
	}
	return name;
}

/**
 * Escapes the XML special characters and drops what XML 1.0 can't hold: control characters other than tab and line
 * breaks, and lone surrogates. Names and comments come from whoever has the link, and Excel refuses a file with them.
 */
export function escapeXml(text: string): string {
	return text
		.replace(/[^\t\n\r -퟿-�\u{10000}-\u{10ffff}]/gu, '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}
