import { describe, expect, it } from 'vitest';
import { matchRoute } from './routes';

describe('matchRoute', () => {
	it('matches the start page with and without trailing slash', () => {
		expect(matchRoute('/')).toEqual({ name: 'home' });
		expect(matchRoute('')).toEqual({ name: 'home' });
		expect(matchRoute('//')).toEqual({ name: 'home' });
	});

	it('matches the page for a new poll', () => {
		expect(matchRoute('/new')).toEqual({ name: 'new' });
		expect(matchRoute('/new/')).toEqual({ name: 'new' });
		expect(matchRoute('/new/x')).toEqual({ name: 'not-found' });
	});

	it('matches the list of my polls', () => {
		expect(matchRoute('/my')).toEqual({ name: 'my' });
		expect(matchRoute('/my/')).toEqual({ name: 'my' });
	});

	it('matches polls by their 32-hex ID only', () => {
		const id = '0123456789abcdef0123456789abcdef';
		expect(matchRoute(`/p/${id}`)).toEqual({ name: 'poll', id });
		expect(matchRoute(`/p/${id}/`)).toEqual({ name: 'poll', id });
		expect(matchRoute(`/p/${id.toUpperCase()}`)).toEqual({ name: 'not-found' });
		expect(matchRoute(`/p/${id}0`)).toEqual({ name: 'not-found' });
		expect(matchRoute(`/p/${id}/x`)).toEqual({ name: 'not-found' });
		expect(matchRoute('/p/')).toEqual({ name: 'not-found' });
	});

	it('returns not-found for unknown paths', () => {
		expect(matchRoute('/nope')).toEqual({ name: 'not-found' });
		expect(matchRoute('/index.html')).toEqual({ name: 'not-found' });
	});
});
