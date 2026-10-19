/** Saves text as a file: a Blob URL behind a temporary link, so that nothing leaves the browser. */
export function downloadText(filename: string, text: string, type: string): void {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	// Some browsers read the Blob only after click() returned.
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
