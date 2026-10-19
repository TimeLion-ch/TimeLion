import { expect, test } from './fixtures';

// The font is a data: URI inside index.html; the guard fails the test if the CSP blocks it.
test('the brand font loads from the page itself', async ({ page }) => {
	await page.goto('/');

	const status = await page.evaluate(async () => {
		await document.fonts.ready;
		return [...document.fonts].find((face) => face.family.replaceAll('"', '') === 'Plus Jakarta Sans')?.status;
	});
	expect(status).toBe('loaded');
});
