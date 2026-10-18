import { describe, expect, it } from 'vitest';
import de from '../locales/de.json';
import en from '../locales/en.json';
import { detectLocale, isLocale, translate } from './i18n';

describe('locale files', () => {
	it('all define exactly the same keys', () => {
		expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
	});

	it('use the same placeholders in every language', () => {
		const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
		for (const [key, text] of Object.entries(de)) {
			expect(placeholders(en[key as keyof typeof en]), key).toEqual(placeholders(text));
		}
	});
});

describe('detectLocale', () => {
	it('prefers the stored choice', () => {
		expect(detectLocale('en', ['de-CH'])).toBe('en');
	});

	it('falls back to the first supported browser language', () => {
		expect(detectLocale(null, ['fr-CH', 'en-GB', 'de'])).toBe('en');
	});

	it('ignores invalid stored values and defaults to German', () => {
		expect(detectLocale('xx', ['fr'])).toBe('de');
	});
});

describe('isLocale', () => {
	it('accepts supported locales only', () => {
		expect(isLocale('de')).toBe(true);
		expect(isLocale('fr')).toBe(false);
		expect(isLocale(undefined)).toBe(false);
	});
});

describe('translate', () => {
	const messages = { greeting: 'Hallo {name}, {count} neue' };
	const fallback = { greeting: 'Hello', onlyFallback: 'Fallback' };

	it('fills placeholders', () => {
		expect(translate(messages, fallback, 'greeting', { name: 'Ada', count: 3 })).toBe('Hallo Ada, 3 neue');
	});

	it('keeps unknown placeholders', () => {
		expect(translate(messages, fallback, 'greeting', { name: 'Ada' })).toBe('Hallo Ada, {count} neue');
	});

	it('falls back to the default locale, then to the key', () => {
		expect(translate(messages, fallback, 'onlyFallback')).toBe('Fallback');
		expect(translate(messages, fallback, 'missing')).toBe('missing');
	});
});
