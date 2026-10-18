/** Pure translation helpers (no DOM, no state) – the reactive wrapper lives in i18n.svelte.ts. */

export const locales = ['de', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'de';

export type Messages = Readonly<Record<string, string>>;
export type Params = Readonly<Record<string, string | number>>;

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** Picks the stored choice, then the first supported browser language, then the default. */
export function detectLocale(stored: string | null, preferred: readonly string[]): Locale {
	if (isLocale(stored)) {
		return stored;
	}
	for (const tag of preferred) {
		const language = tag.toLowerCase().split('-')[0];
		if (isLocale(language)) {
			return language;
		}
	}
	return defaultLocale;
}

/** Looks up `key` (falling back to `fallback`, then to the key itself) and fills `{name}` placeholders. */
export function translate(messages: Messages, fallback: Messages, key: string, params?: Params): string {
	const template = messages[key] ?? fallback[key] ?? key;
	if (params === undefined) {
		return template;
	}
	return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
		Object.hasOwn(params, name) ? String(params[name]) : placeholder,
	);
}
