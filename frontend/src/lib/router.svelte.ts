import { matchRoute, type Route } from './routes';

let current = $state<Route>(matchRoute(location.pathname));

window.addEventListener('popstate', () => {
	current = matchRoute(location.pathname);
});

export const router = {
	get route(): Route {
		return current;
	},
};

/** Client-side navigation. `path` may include a fragment (e.g. a poll link with its key). */
export function navigate(path: string, options: { replace?: boolean } = {}): void {
	if (options.replace) {
		history.replaceState(null, '', path);
	} else {
		history.pushState(null, '', path);
	}
	current = matchRoute(location.pathname);
	window.scrollTo(0, 0);
}

/** Svelte action for internal links: `<a href="/" use:link>`. Modified clicks keep browser behaviour. */
export function link(node: HTMLAnchorElement) {
	const onClick = (event: MouseEvent) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		const url = new URL(node.href);
		if (url.origin !== location.origin || node.target === '_blank') {
			return;
		}
		event.preventDefault();
		navigate(url.pathname + url.search + url.hash);
	};

	node.addEventListener('click', onClick);
	return {
		destroy() {
			node.removeEventListener('click', onClick);
		},
	};
}
