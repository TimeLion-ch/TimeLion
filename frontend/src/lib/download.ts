/** Saves data as a file: a Blob URL behind a temporary link, so that nothing leaves the browser. */
export function downloadFile(filename: string, data: BlobPart, type: string): void {
	const url = URL.createObjectURL(new Blob([data], { type }));
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	// Some browsers read the Blob only after click() returned.
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A file name from a poll's title: letters, digits, spaces and dashes only. */
export function fileName(title: string, extension: string): string {
	const name = title
		.normalize('NFC')
		.replace(/[^\p{L}\p{N} _-]+/gu, '')
		.trim()
		.replace(/\s+/g, '-')
		.slice(0, 60);
	return `${name === '' ? 'timelion' : name}.${extension}`;
}
