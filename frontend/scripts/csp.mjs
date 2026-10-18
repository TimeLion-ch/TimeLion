import { createHash } from 'node:crypto';

/**
 * @param {string} content
 * @returns {string} CSP source expression, e.g. 'sha256-…'
 */
export function cspHash(content) {
	return `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`;
}

/**
 * Collects the CSP hashes of all inline <script> and <style> elements and makes sure the page loads
 * nothing else: a single-file build must not reference external scripts or stylesheets.
 *
 * @param {string} html
 * @returns {{ scripts: string[], styles: string[] }}
 */
export function inlineHashes(html) {
	if (/<script\b[^>]*\bsrc\s*=/i.test(html)) {
		throw new Error('index.html references an external script – the build must be a single file.');
	}
	if (/<link\b[^>]*\brel\s*=\s*["']?(?:stylesheet|modulepreload|preload)/i.test(html)) {
		throw new Error('index.html references an external stylesheet or preload – the build must be a single file.');
	}

	const contents = (/** @type {RegExp} */ pattern) =>
		[...html.matchAll(pattern)].map((match) => match[1] ?? '').filter((content) => content.trim() !== '');

	const scripts = contents(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi).map(cspHash);
	const styles = contents(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi).map(cspHash);
	if (scripts.length === 0) {
		throw new Error('index.html contains no inline script – did vite-plugin-singlefile run?');
	}

	return { scripts, styles };
}

/**
 * @param {string} template contents of htaccess.template
 * @param {{ scripts: string[], styles: string[] }} hashes
 * @returns {string}
 */
export function renderHtaccess(template, hashes) {
	const replacements = {
		'{{CSP_SCRIPT_SRC}}': hashes.scripts.join(' '),
		'{{CSP_STYLE_SRC}}': hashes.styles.length > 0 ? hashes.styles.join(' ') : "'none'",
	};

	let result = template;
	for (const [placeholder, value] of Object.entries(replacements)) {
		if (!result.includes(placeholder)) {
			throw new Error(`htaccess.template is missing the ${placeholder} placeholder.`);
		}
		result = result.replaceAll(placeholder, value);
	}

	return result;
}
