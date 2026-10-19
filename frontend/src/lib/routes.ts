/**
 * Route table. Routes are real paths (History API) because the URL fragment is reserved for
 * the poll key (see CLAUDE.md → Encryption). Add new routes here and handle them in App.svelte.
 */
export type Route =
	{ name: 'home' } | { name: 'new' } | { name: 'my' } | { name: 'poll'; id: string } | { name: 'not-found' };

/** Poll IDs are 32 lowercase hex characters (docs/api.md); anything else is not a poll. */
const POLL_PATH = /^\/p\/([0-9a-f]{32})$/;

export function matchRoute(pathname: string): Route {
	const path = pathname.replace(/\/+$/, '') || '/';

	if (path === '/') {
		return { name: 'home' };
	}
	if (path === '/new') {
		return { name: 'new' };
	}
	if (path === '/my') {
		return { name: 'my' };
	}
	const poll = POLL_PATH.exec(path);
	if (poll?.[1] !== undefined) {
		return { name: 'poll', id: poll[1] };
	}

	return { name: 'not-found' };
}
