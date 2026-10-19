/**
 * The small text format of pages whose text comes from config.php (the privacy policy): headings, paragraphs, lists
 * and links, nothing more. It never becomes HTML; components render the blocks as text.
 *
 *   ## Heading    a heading; `### ` for a subheading (`# ` counts as `## `, as the page has its own title)
 *   - item        a list item (`* ` too); indented lines continue it
 *   text          a paragraph; blank lines separate paragraphs, line breaks within one are kept (addresses)
 *
 * `https://` URLs and e-mail addresses in the text become links; nothing else does.
 */

/** A piece of text, a link if it has `href` (`https:` or `mailto:` only). */
export type Inline = { text: string; href?: string };

export type Block =
	| { type: 'heading'; level: 2 | 3; content: Inline[] }
	| { type: 'paragraph'; content: Inline[] }
	| { type: 'list'; items: Inline[][] };

const HEADING = /^(#{1,3})\s+(.+)$/;
const ITEM = /^[-*]\s+(.+)$/;

export function parseMarkup(source: string): Block[] {
	const blocks: Block[] = [];
	let paragraph: string[] = [];
	let items: string[] = [];

	const endParagraph = () => {
		if (paragraph.length > 0) {
			blocks.push({ type: 'paragraph', content: linkify(paragraph.join('\n')) });
			paragraph = [];
		}
	};
	const endList = () => {
		if (items.length > 0) {
			blocks.push({ type: 'list', items: items.map(linkify) });
			items = [];
		}
	};

	for (const raw of source.split(/\r\n?|\n/)) {
		const line = raw.trimEnd();
		const heading = HEADING.exec(line.trimStart());
		const item = ITEM.exec(line.trimStart());
		if (line === '') {
			endParagraph();
			endList();
		} else if (heading !== null) {
			endParagraph();
			endList();
			const [, hashes = '', text = ''] = heading;
			blocks.push({ type: 'heading', level: hashes.length === 3 ? 3 : 2, content: linkify(text.trim()) });
		} else if (item !== null) {
			endParagraph();
			items.push(item[1] ?? '');
		} else if (items.length > 0 && /^\s/.test(line)) {
			items[items.length - 1] += ` ${line.trim()}`;
		} else {
			endList();
			paragraph.push(line.trim());
		}
	}
	endParagraph();
	endList();
	return blocks;
}

/** URLs end before trailing punctuation, so that "see https://example.ch." links without the full stop. */
const LINK = /https:\/\/[^\s<>"«»]+?(?=[.,;:!?)»]*(?:\s|$))|[\w.%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

export function linkify(text: string): Inline[] {
	const parts: Inline[] = [];
	let last = 0;
	for (const match of text.matchAll(LINK)) {
		const [link] = match;
		if (match.index > last) {
			parts.push({ text: text.slice(last, match.index) });
		}
		parts.push({ text: link, href: link.startsWith('https://') ? link : `mailto:${link}` });
		last = match.index + link.length;
	}
	if (last < text.length) {
		parts.push({ text: text.slice(last) });
	}
	return parts;
}
