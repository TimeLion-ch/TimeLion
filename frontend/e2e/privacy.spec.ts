import { expect, test } from './fixtures';

// The text comes from e2e/config.php (privacy_policy) through GET /api/privacy-policy.
test('the privacy policy from the configuration', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'Privacy' }).click();

	await expect(page).toHaveURL(/\/privacy$/);
	await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
	await expect(page.getByText('This privacy policy is only available in German.')).toBeVisible();

	const text = page.locator('[lang="de"]');
	await expect(text.getByRole('heading', { level: 2 })).toHaveText(['Verantwortlich', 'Was gespeichert wird']);
	await expect(text.locator('p').first()).toHaveText('Max Muster\nBeispielweg 1\n3000 Bern\ndatenschutz@example.ch', {
		useInnerText: true,
	});
	await expect(text.getByRole('link', { name: 'datenschutz@example.ch' })).toHaveAttribute(
		'href',
		'mailto:datenschutz@example.ch',
	);
	await expect(text.getByRole('listitem')).toHaveText([
		'die verschlüsselten Daten',
		'eine zufällige Kennung, ohne Bezug zu dir',
	]);
	await expect(text.locator('p').last()).toHaveText('Beschwerden: https://www.edoeb.admin.ch.');
	await expect(text.getByRole('link', { name: 'https://www.edoeb.admin.ch' })).toHaveAttribute(
		'href',
		'https://www.edoeb.admin.ch',
	);
});
