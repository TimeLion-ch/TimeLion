import de from '../locales/de.json';
import en from '../locales/en.json';
import { defaultLocale, detectLocale, type Locale, type Messages, type Params, translate } from './i18n';
import { storage } from './storage';

/** de.json is the source of truth for keys; i18n.test.ts makes sure every locale has the same keys. */
export type MessageKey = keyof typeof de;

const catalogs: Record<Locale, Messages> = { de, en };
const STORAGE_KEY = 'timelion.locale';

const initial = detectLocale(storage.get(STORAGE_KEY), navigator.languages);
let current = $state<Locale>(initial);
document.documentElement.lang = initial;

export const i18n = {
	get locale(): Locale {
		return current;
	},
	set locale(locale: Locale) {
		current = locale;
		storage.set(STORAGE_KEY, locale);
		document.documentElement.lang = locale;
	},
};

/** Reactive: templates using t() re-render when the locale changes. */
export function t(key: MessageKey, params?: Params): string {
	return translate(catalogs[current], catalogs[defaultLocale], key, params);
}
