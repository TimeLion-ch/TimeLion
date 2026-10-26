/**
 * A ZIP archive (PKWARE APPNOTE) of stored, uncompressed files: enough for an Excel workbook (xlsx.ts), without a
 * library. Every file gets the same fixed date, so the same files always give the same bytes.
 */

export type ZipEntry = { name: string; data: Uint8Array };

/** 1980-01-01, the earliest date ZIP can store (MS-DOS format: years since 1980, month, day). */
const DOS_DATE = (1 << 5) | 1;

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
	let value = index;
	for (let bit = 0; bit < 8; bit++) {
		value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
	}
	return value >>> 0;
});

/** The CRC-32 that ZIP stores for each file (ISO 3309). */
export function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

export function zip(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
	const encoder = new TextEncoder();
	const files: Uint8Array[] = [];
	const directory: Uint8Array[] = [];
	let offset = 0;
	for (const { name, data } of entries) {
		const nameBytes = encoder.encode(name);
		// Version needed (2.0), flags, method (stored), time, date, CRC-32, both sizes, name length, extra field length.
		const fields = [
			u16(20),
			u16(0),
			u16(0),
			u16(0),
			u16(DOS_DATE),
			u32(crc32(data)),
			u32(data.length),
			u32(data.length),
			u16(nameBytes.length),
			u16(0),
		];
		files.push(u32(0x04034b50), ...fields, nameBytes, data);
		// Version made by, the same fields, then comment length, disk, internal and external attributes, offset.
		directory.push(u32(0x02014b50), u16(20), ...fields, u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes);
		offset += 30 + nameBytes.length + data.length;
	}
	const directorySize = directory.reduce((size, part) => size + part.length, 0);
	const end = [
		u32(0x06054b50),
		u16(0),
		u16(0),
		u16(entries.length),
		u16(entries.length),
		u32(directorySize),
		u32(offset),
		u16(0),
	];
	return concat([...files, ...directory, ...end]);
}

function u16(value: number): Uint8Array {
	return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
	return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function concat(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
	const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
	let position = 0;
	for (const part of parts) {
		result.set(part, position);
		position += part.length;
	}
	return result;
}
