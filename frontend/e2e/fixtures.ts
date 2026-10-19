import { test as base, expect, type BrowserContext, type Page, type Request } from '@playwright/test';

export { expect };

/** What the browsers of a test did; checked when the test ends. */
export type Guard = {
	/** Every request to the app's own origin, for checking what reached the server. */
	sent: Request[];
	/** Requests to any other origin. They are blocked, and there must be none. */
	external: string[];
	/** Content Security Policy violations reported in the console. There must be none. */
	cspViolations: string[];
	/** Uncaught errors in a page. There must be none. */
	errors: string[];
};

type Fixtures = {
	guard: Guard;
	/** A page in another browser context, like another person's browser: its own storage, also watched. */
	newPage: () => Promise<Page>;
};

/**
 * `test` with a guard on every browser context: the app must not contact other origins, violate its CSP or throw.
 */
export const test = base.extend<Fixtures>({
	guard: [
		async ({}, use) => {
			const guard: Guard = { sent: [], external: [], cspViolations: [], errors: [] };
			await use(guard);
			expect(guard.external, 'requests to other origins').toEqual([]);
			expect(guard.cspViolations, 'Content Security Policy violations').toEqual([]);
			expect(guard.errors, 'uncaught errors').toEqual([]);
		},
		{ auto: true },
	],

	context: async ({ context, guard, baseURL }, use) => {
		await watch(context, guard, baseURL);
		await use(context);
	},

	newPage: async ({ browser, guard, baseURL, locale, timezoneId }, use) => {
		const contexts: BrowserContext[] = [];
		await use(async () => {
			const context = await browser.newContext({ baseURL, locale, timezoneId });
			contexts.push(context);
			await watch(context, guard, baseURL);
			return context.newPage();
		});
		await Promise.all(contexts.map((context) => context.close()));
	},
});

async function watch(context: BrowserContext, guard: Guard, baseURL: string | undefined): Promise<void> {
	if (baseURL === undefined) {
		throw new Error('playwright.config.ts must set use.baseURL.');
	}
	const origin = new URL(baseURL).origin;
	// data: and blob: URLs never reach a route handler, so this sees exactly the requests that would leave the browser.
	await context.route(
		(url) => url.origin !== origin,
		async (route) => {
			guard.external.push(route.request().url());
			await route.abort('blockedbyclient');
		},
	);
	context.on('request', (request) => {
		if (new URL(request.url()).origin === origin) {
			guard.sent.push(request);
		}
	});
	context.on('console', (message) => {
		if (message.text().includes('Content Security Policy')) {
			guard.cspViolations.push(message.text());
		}
	});
	context.on('weberror', (error) => guard.errors.push(error.error().message));
}
