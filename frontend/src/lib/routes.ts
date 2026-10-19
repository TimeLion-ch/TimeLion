/**
 * Route table. Routes are real paths (History API) because the URL fragment is reserved for
 * the poll key (see CLAUDE.md → Encryption). Add new routes here and handle them in App.svelte.
 */
export type Route = { name: 'home' } | { name: 'new' } | { name: 'not-found' };

export function matchRoute(pathname: string): Route {
	const path = pathname.replace(/\/+$/, '') || '/';

	if (path === '/') {
		return { name: 'home' };
	}
	if (path === '/new') {
		return { name: 'new' };
	}

	return { name: 'not-found' };
}
