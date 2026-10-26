import { describe, expect, it } from 'vitest';
import { crc32, zip } from './zip';

const encoder = new TextEncoder();

/** Reads a ZIP archive the way unzip does: from the end record through the central directory to each file. */
function unzip(archive: Uint8Array): Map<string, string> {
	const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
	const end = archive.length - 22;
	expect(view.getUint32(end, true)).toBe(0x06054b50);
	const count = view.getUint16(end + 10, true);
	let position = view.getUint32(end + 16, true);
	expect(position + view.getUint32(end + 12, true)).toBe(end);

	const files = new Map<string, string>();
	for (let index = 0; index < count; index++) {
		expect(view.getUint32(position, true)).toBe(0x02014b50);
		const crc = view.getUint32(position + 16, true);
		const size = view.getUint32(position + 24, true);
		const nameLength = view.getUint16(position + 28, true);
		const offset = view.getUint32(position + 42, true);
		const name = new TextDecoder().decode(archive.subarray(position + 46, position + 46 + nameLength));

		expect(view.getUint32(offset, true)).toBe(0x04034b50);
		expect(view.getUint16(offset + 8, true), 'stored').toBe(0);
		expect(view.getUint32(offset + 14, true)).toBe(crc);
		const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
		const data = archive.subarray(start, start + size);
		expect(crc32(data)).toBe(crc);
		files.set(name, new TextDecoder().decode(data));
		position += 46 + nameLength;
	}
	return files;
}

describe('crc32', () => {
	it('computes the standard check values', () => {
		expect(crc32(new Uint8Array())).toBe(0);
		expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
		expect(crc32(encoder.encode('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
	});
});

describe('zip', () => {
	it('stores the files with their names and contents', () => {
		const archive = zip([
			{ name: '[Content_Types].xml', data: encoder.encode('<Types/>') },
			{ name: 'xl/worksheets/sheet1.xml', data: encoder.encode('Grüezi 🦁') },
			{ name: 'empty', data: new Uint8Array() },
		]);
		expect(archive.subarray(0, 4)).toEqual(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
		expect(unzip(archive)).toEqual(
			new Map([
				['[Content_Types].xml', '<Types/>'],
				['xl/worksheets/sheet1.xml', 'Grüezi 🦁'],
				['empty', ''],
			]),
		);
	});

	it('gives the same bytes for the same files', () => {
		const files = [{ name: 'a.txt', data: encoder.encode('a') }];
		expect(zip(files)).toEqual(zip(files));
	});

	it('writes an empty archive as the end record alone', () => {
		expect(zip([])).toEqual(new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array<number>(18).fill(0)]));
	});
});
