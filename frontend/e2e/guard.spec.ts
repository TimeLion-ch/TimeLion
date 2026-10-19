import { expect, test } from './fixtures';

// The other tests pass only if the guard sees nothing, so make sure it would see something.
test('the guard catches CSP violations and requests to other origins', async ({ page, guard }) => {
	await page.goto('/');

	await page.evaluate(() => document.body.setAttribute('style', 'color: red'));
	await expect.poll(() => guard.cspViolations).toHaveLength(1);

	await expect(page.goto('https://example.com/')).rejects.toThrow();
	expect(guard.external).toEqual(['https://example.com/']);

	// Both were on purpose.
	guard.cspViolations.length = 0;
	guard.external.length = 0;
});
