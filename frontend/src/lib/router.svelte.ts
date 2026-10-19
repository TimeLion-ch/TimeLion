import { matchRoute, type Route } from './routes';

/** Data of the current history entry. Browsers keep it across reloads and back/forward, but not in new tabs. */
export type HistoryState = {
	/** The poll was just created here: show its links once (share screen). */
	created?: true;
};

let current = $state<Route>(matchRoute(location.pathname));
let state = $state<HistoryState>(readState());

window.addEventListener('popstate', () => {
	current = matchRoute(location.pathname);
	state = readState();
});

export const router = {
	get route(): Route {
		return current;
	},
	get state(): HistoryState {
		return state;
	},
};

/** Client-side navigation. `path` may include a fragment (e.g. a poll link with its key). */
export function navigate(path: string, options: { replace?: boolean; state?: HistoryState } = {}): void {
	const next = options.state ?? {};
	if (options.replace) {
		history.replaceState(next, '', path);
	} else {
		history.pushState(next, '', path);
	}
	current = matchRoute(location.pathname);
	state = next;
	window.scrollTo(0, 0);
}

/** Changes the state of the current history entry without navigating. */
export function replaceState(next: HistoryState): void {
	history.replaceState(next, '', location.href);
	state = next;
}

function readState(): HistoryState {
	const value: unknown = history.state;
	return typeof value === 'object' && value !== null && 'created' in value && value.created === true
		? { created: true }
		: {};
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
