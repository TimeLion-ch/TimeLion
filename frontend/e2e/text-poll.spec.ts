import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Creates the text poll "Lunch" with these options and limits, and returns its participant link. */
async function createTextPoll(page: Page, options: string[], limits: { min?: string; max?: string }) {
	await page.goto('/new');
	await page.getByLabel('Title', { exact: true }).fill('Lunch');
	await page.getByRole('radio', { name: 'Text options' }).check();
	for (const [index, text] of options.entries()) {
		if (index >= 2) {
			await page.getByRole('button', { name: 'Add an option' }).click();
		}
		await page.getByLabel(`Option ${index + 1}`, { exact: true }).fill(text);
	}
	await page.getByLabel('At least').fill(limits.min ?? '');
	await page.getByLabel('At most').fill(limits.max ?? '');
	await page.getByRole('button', { name: 'Create poll' }).click();
	return page.getByLabel('Participant link').inputValue();
}

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

test('the voting form checks the choice limits', async ({ page, newPage }) => {
	const link = await createTextPoll(page, ['Pizza', 'Sushi', 'Curry'], { min: '1', max: '2' });
	const participant = await newPage();
	await participant.goto(link);
	const options = participant.locator('form fieldset');

	await expect(participant.getByText('Choose 1 to 2 options. “Maybe” counts as a choice too.')).toBeVisible();
	await participant.getByLabel('Your name').fill('Grace Hopper');
	await options.nth(0).getByRole('radio', { name: 'Yes' }).check();
	await options.nth(1).getByRole('radio', { name: 'Maybe' }).check();
	await options.nth(2).getByRole('radio', { name: 'Yes' }).check();
	await expect(participant.getByText('Chosen: 3')).toBeVisible();
	await participant.getByRole('button', { name: 'Send response' }).click();
	await expect(participant.getByText('You have chosen too many options.')).toBeVisible();
	await expect(participant.getByRole('list', { name: 'Choose 1 to 2 options.' })).toBeFocused();

	await options.nth(2).getByRole('radio', { name: 'No' }).check();
	await expect(participant.getByText('You have chosen too many options.')).toHaveCount(0);
	await participant.getByRole('button', { name: 'Send response' }).click();
	await expect(participant.getByText('Thank you! Your response is saved.')).toBeVisible();
	await expect(participant.getByRole('row', { name: 'Grace Hopper (you)' }).getByRole('cell')).toHaveText([
		'Yes',
		'Maybe',
		'No',
	]);
});

test('editing the text of an option keeps its votes', async ({ page, newPage }) => {
	const link = await createTextPoll(page, ['Pizza', 'Sushi'], {});
	const participant = await newPage();
	await participant.goto(link);
	await participant.getByLabel('Your name').fill('Grace Hopper');
	await participant.locator('form fieldset').nth(0).getByRole('radio', { name: 'Yes' }).check();
	await participant.getByRole('button', { name: 'Send response' }).click();
	await expect(participant.getByText('Thank you! Your response is saved.')).toBeVisible();

	await page.getByRole('button', { name: 'Go to the poll' }).click();
	await page.getByRole('button', { name: 'Manage poll' }).click();
	await page.getByRole('button', { name: 'Edit poll' }).click();
	await expect(page.getByRole('heading', { name: 'Edit poll' })).toBeVisible();
	await expect(page.getByRole('radio', { name: 'Text options' })).toHaveCount(0);
	await page.getByLabel('Option 1', { exact: true }).fill('Pizza Margherita');
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByText('The changes to the poll are saved.')).toBeVisible();

	// The voted option is also tagged "Most popular".
	await expect(page.getByRole('columnheader')).toHaveText(['Participant', /^Pizza Margherita/, /^Sushi/]);
	await expect(page.getByRole('row', { name: 'Grace Hopper' }).getByRole('cell')).toHaveText(['Yes', 'No answer']);
});
