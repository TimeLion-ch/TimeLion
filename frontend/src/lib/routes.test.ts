import { describe, expect, it } from 'vitest';
import { matchRoute } from './routes';

describe('matchRoute', () => {
	it('matches the start page with and without trailing slash', () => {
		expect(matchRoute('/')).toEqual({ name: 'home' });
		expect(matchRoute('')).toEqual({ name: 'home' });
		expect(matchRoute('//')).toEqual({ name: 'home' });
	});

	it('returns not-found for unknown paths', () => {
		expect(matchRoute('/nope')).toEqual({ name: 'not-found' });
		expect(matchRoute('/index.html')).toEqual({ name: 'not-found' });
	});
});
