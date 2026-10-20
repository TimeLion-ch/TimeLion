import { expect, test } from './fixtures';

test('a text poll with choice limits shows its options in the order they were entered', async ({ page }) => {
	await test.step('enter and reorder the options', async () => {
		await page.goto('/new');
		await page.getByRole('radio', { name: 'Text options' }).check();
		await expect(page.getByRole('button', { name: 'Next month' })).toHaveCount(0);
		await page.getByLabel('Option 1', { exact: true }).fill('Pizza');
		await page.getByLabel('Option 2', { exact: true }).fill('Sushi');
		await page.getByRole('button', { name: 'Add an option' }).click();
		await page.getByLabel('Option 3', { exact: true }).fill('Curry');
		await page.getByRole('button', { name: 'Move option 3 up' }).click();
		await expect(page.getByRole('button', { name: 'Move option 2 up' })).toBeFocused();
		await expect(page.getByLabel('Option 2', { exact: true })).toHaveValue('Curry');
	});

	await test.step('the limits are checked before the poll is created', async () => {
		await page.getByLabel('Title', { exact: true }).fill('Lunch');
		await page.getByLabel('At least').fill('3');
		await page.getByLabel('At most').fill('2');
		await page.getByRole('button', { name: 'Create poll' }).click();
		await expect(page.getByText('The minimum is above the maximum.')).toBeVisible();
		await expect(page.getByLabel('At least')).toBeFocused();
		await page.getByLabel('At least').fill('1');
		await expect(page.getByText('The minimum is above the maximum.')).toHaveCount(0);
		await page.getByRole('button', { name: 'Create poll' }).click();
		await page.getByRole('button', { name: 'Go to the poll' }).click();
	});

	await expect(page.getByRole('columnheader')).toHaveText(['Participant', 'Pizza', 'Curry', 'Sushi']);
	await expect(page.locator('form fieldset legend')).toHaveText(['Pizza', 'Curry', 'Sushi']);
	await expect(page.getByText('Times in')).toHaveCount(0);
});
