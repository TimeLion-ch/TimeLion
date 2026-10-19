import { expect, test } from './fixtures';

// dev/router.php sends the page headers of the generated public/.htaccess, so this checks what Apache will send.
test('the page comes with its security headers', async ({ page }) => {
	const response = await page.goto('/');
	const headers = response?.headers() ?? {};

	// Scripts and styles only by the hashes of the inlined code.
	expect(headers['content-security-policy']).toMatch(
		/^default-src 'none'; script-src( 'sha256-[A-Za-z0-9+/]+={0,2}')+; style-src( 'sha256-[A-Za-z0-9+/]+={0,2}')+;/,
	);
	expect(headers).toMatchObject({
		'referrer-policy': 'no-referrer',
		'x-content-type-options': 'nosniff',
		'x-frame-options': 'DENY',
		'cross-origin-opener-policy': 'same-origin',
		'cache-control': 'no-cache',
	});
	expect(headers['permissions-policy']).toContain('camera=()');
	expect(headers['strict-transport-security']).toMatch(/^max-age=\d+/);
});
