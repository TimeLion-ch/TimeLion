import { describe, expect, it } from 'vitest';
import { linkify, parseMarkup } from './markup';

const text = (value: string) => [{ text: value }];

describe('parseMarkup', () => {
	it('reads headings, paragraphs and lists', () => {
		const source = [
			'## Verantwortlich',
			'',
			'Max Muster',
			'Beispielweg 1',
			'',
			'### Daten',
			'- erstens',
			'- zweitens',
		].join('\n');

		expect(parseMarkup(source)).toEqual([
			{ type: 'heading', level: 2, content: text('Verantwortlich') },
			{ type: 'paragraph', content: text('Max Muster\nBeispielweg 1') },
			{ type: 'heading', level: 3, content: text('Daten') },
			{ type: 'list', items: [text('erstens'), text('zweitens')] },
		]);
	});

	it('treats # as a section heading, as the page has its own title', () => {
		expect(parseMarkup('# Titel')).toEqual([{ type: 'heading', level: 2, content: text('Titel') }]);
	});

	it('needs a space after # and -', () => {
		expect(parseMarkup('#hashtag\n-5 Grad')).toEqual([{ type: 'paragraph', content: text('#hashtag\n-5 Grad') }]);
	});

	it('continues list items on indented lines and ends lists at other lines', () => {
		expect(parseMarkup('Vorher:\n- eins\n  und mehr\n* zwei\nNachher')).toEqual([
			{ type: 'paragraph', content: text('Vorher:') },
			{ type: 'list', items: [text('eins und mehr'), text('zwei')] },
			{ type: 'paragraph', content: text('Nachher') },
		]);
	});

	it('accepts Windows line breaks, trailing spaces and indentation', () => {
		expect(parseMarkup('  ## Titel  \r\n\r\n  Text  \r\n')).toEqual([
			{ type: 'heading', level: 2, content: text('Titel') },
			{ type: 'paragraph', content: text('Text') },
		]);
	});

	it('returns nothing for empty text', () => {
		expect(parseMarkup('')).toEqual([]);
		expect(parseMarkup('\n \n')).toEqual([]);
	});

	it('keeps HTML as text', () => {
		expect(parseMarkup('<script>alert(1)</script>')).toEqual([
			{ type: 'paragraph', content: text('<script>alert(1)</script>') },
		]);
	});
});

describe('linkify', () => {
	it('links https URLs without trailing punctuation', () => {
		expect(linkify('Siehe https://www.edoeb.admin.ch.')).toEqual([
			{ text: 'Siehe ' },
			{ text: 'https://www.edoeb.admin.ch', href: 'https://www.edoeb.admin.ch' },
			{ text: '.' },
		]);
		expect(linkify('(https://example.ch/a?b=1#c)')).toEqual([
			{ text: '(' },
			{ text: 'https://example.ch/a?b=1#c', href: 'https://example.ch/a?b=1#c' },
			{ text: ')' },
		]);
	});

	it('links e-mail addresses with mailto', () => {
		expect(linkify('Schreib an info@example.ch, bitte.')).toEqual([
			{ text: 'Schreib an ' },
			{ text: 'info@example.ch', href: 'mailto:info@example.ch' },
			{ text: ', bitte.' },
		]);
	});

	it('links nothing else', () => {
		for (const value of ['http://example.ch', 'javascript:alert(1)', 'data:text/html,x', 'www.example.ch', 'a@b']) {
			expect(linkify(value)).toEqual(text(value));
		}
	});
});
