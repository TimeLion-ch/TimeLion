/**
 * localStorage that never throws: storage can be unavailable (private mode, blocked site data),
 * so callers must treat every value as optional.
 */
export const storage = {
	get(key: string): string | null {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	},
	set(key: string, value: string): void {
		try {
			localStorage.setItem(key, value);
		} catch {
			// Storage unavailable – the value only lives for this page view.
		}
	},
	remove(key: string): void {
		try {
			localStorage.removeItem(key);
		} catch {
			// Storage unavailable – nothing to remove.
		}
	},
};
