import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';

/** Day `day` of next month as `YYYY-MM-DD`: always in the future and within a poll's maximum lifetime. */
function nextMonth(day: number): string {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day)).toISOString().slice(0, 10);
}

test('a poll from creation to deletion, without the server seeing its content', async ({ page, newPage, guard }) => {
	const title = 'Team dinner';
	const description = 'Bring a dessert if you like.';
	const location = 'Restaurant Löwen';
	const name = 'Ada Lovelace';
	const comment = 'Fridays suit me best.';
	const first = nextMonth(10);
	const second = nextMonth(12);

	await test.step('create a poll', async () => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Create a poll' }).click();
		await page.getByLabel('Title', { exact: true }).fill(title);
		await page.getByLabel('Description').fill(description);
		await page.getByLabel('Location').fill(location);
		await page.getByRole('button', { name: 'Next month' }).click();
		await page.locator(`button[data-date="${first}"]`).click();
		await page.locator(`button[data-date="${second}"]`).click();
		await page.getByRole('button', { name: 'Create poll' }).click();
		await expect(page.getByRole('heading', { name: 'Your poll is ready' })).toBeVisible();
	});

	const participantLink = await page.getByLabel('Participant link').inputValue();
	const adminLink = await page.getByLabel('Admin link').inputValue();
	const key = new URLSearchParams(new URL(participantLink).hash.slice(1)).get('k') ?? '';
	expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
	expect(adminLink.startsWith(participantLink)).toBe(true);
	expect(adminLink.slice(participantLink.length)).toMatch(/^&a=[A-Za-z0-9_-]{43}$/);

	await page.getByRole('button', { name: 'Go to the poll' }).click();
	await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
	await expect(page.getByText('No responses yet.')).toBeVisible();

	// The participant uses another browser: no admin token, no saved polls.
	const participant = await newPage();
	const options = participant.locator('form fieldset');

	await test.step('vote', async () => {
		await participant.goto(participantLink);
		await expect(participant.getByRole('heading', { name: title, level: 1 })).toBeVisible();
		await expect(participant.getByRole('button', { name: 'Manage poll' })).toHaveCount(0);
		await participant.getByLabel('Your name').fill(name);
		await options.nth(0).getByRole('radio', { name: 'Yes' }).check();
		await options.nth(1).getByRole('radio', { name: 'Maybe' }).check();
		await participant.getByLabel('Comment').fill(comment);
		await participant.getByRole('button', { name: 'Send response' }).click();
		await expect(participant.getByText('Thank you! Your response is saved.')).toBeVisible();
		await expect(participant.getByRole('row', { name: `${name} (you)` }).getByRole('cell')).toHaveText([
			'Yes',
			'Maybe',
		]);
	});

	await test.step('edit the response', async () => {
		await participant.getByRole('button', { name: `Edit the response of ${name}` }).click();
		await expect(participant.getByRole('heading', { name: 'Edit response' })).toBeVisible();
		await options.nth(1).getByRole('radio', { name: 'Yes' }).check();
		await participant.getByRole('button', { name: 'Save changes' }).click();
		await expect(participant.getByText('Your changes are saved.')).toBeVisible();
		await expect(participant.getByRole('row', { name: `${name} (you)` }).getByRole('cell')).toHaveText([
			'Yes',
			'Yes',
		]);
	});

	await test.step('export the results', async () => {
		const csvDownload = participant.waitForEvent('download');
		await participant.getByRole('button', { name: 'Download as CSV' }).click();
		expect((await csvDownload).suggestedFilename()).toBe('Team-dinner.csv');
		const csv = (await readFile(await (await csvDownload).path(), 'utf8')).split('\r\n');
		expect(csv[0]).toMatch(/^﻿Participant,"\w{3}, \d+ \w{3} \d{4}","\w{3}, \d+ \w{3} \d{4}"$/);
		expect(csv.slice(1)).toEqual([
			`${name},Yes,Yes`,
			'Total yes,1,1',
			'Total maybe,0,0',
			'',
			'Comments',
			`${name},${comment}`,
			'',
		]);

		const xlsxDownload = participant.waitForEvent('download');
		await participant.getByRole('button', { name: 'Download as Excel' }).click();
		expect((await xlsxDownload).suggestedFilename()).toBe('Team-dinner.xlsx');
		// Stored uncompressed, so the worksheet's XML is readable in the file as it is.
		const xlsx = (await readFile(await (await xlsxDownload).path())).toString('utf8');
		expect(xlsx.startsWith('PK\u0003\u0004')).toBe(true);
		expect(xlsx).toContain(`<c r="A2" t="inlineStr"><is><t xml:space="preserve">${name}</t></is></c>`);
		expect(xlsx).toContain(`<t xml:space="preserve">${comment}</t>`);

		for (const file of [csv.join('\r\n'), xlsx]) {
			expect(file).not.toContain(key);
		}
	});

	await test.step('close the poll as admin', async () => {
		await page.reload();
		await expect(page.getByRole('row', { name })).toBeVisible();
		await expect(page.getByText(comment)).toBeVisible();
		await page.getByRole('button', { name: 'Manage poll' }).click();
		await page.getByRole('button', { name: 'Close poll' }).click();
		await expect(page.getByText('The poll is now closed.')).toBeVisible();
	});

	await test.step('choose the date', async () => {
		await page.getByLabel('Choose the date').selectOption({ index: 1 });
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(page.getByText('The date is saved.')).toBeVisible();
	});

	await test.step('see the result and add it to a calendar', async () => {
		await participant.reload();
		await expect(participant.getByText('The date is set')).toBeVisible();
		await expect(participant.getByText('This poll is closed.')).toBeVisible();
		await expect(participant.getByRole('heading', { name: 'Your response' })).toHaveCount(0);

		const download = participant.waitForEvent('download');
		await participant.getByRole('button', { name: 'Add to calendar' }).click();
		const ics = await readFile(await (await download).path(), 'utf8');
		expect(ics).toContain(`SUMMARY:${title}\r\n`);
		expect(ics).toContain(`DTSTART;VALUE=DATE:${first.replaceAll('-', '')}\r\n`);
		expect(ics).not.toContain(key);
	});

	await test.step('delete the poll', async () => {
		await page.getByRole('button', { name: 'Delete poll' }).click();
		await page.getByRole('button', { name: 'Delete for good' }).click();
		await expect(page.getByRole('heading', { name: 'Poll deleted' })).toBeVisible();

		await participant.reload();
		await expect(participant.getByRole('heading', { name: 'Poll not found' })).toBeVisible();
	});

	await test.step('the server never got the key or any content', async () => {
		// Create, vote, edit, close, choose the date, delete: the check below covers every write.
		const writes = guard.sent.filter((request) => request.method() !== 'GET').map((request) => request.method());
		expect(writes).toEqual(['POST', 'POST', 'PUT', 'PATCH', 'PATCH', 'DELETE']);

		const sent = await Promise.all(
			guard.sent.map(async (request) =>
				[request.method(), request.url(), JSON.stringify(await request.allHeaders()), request.postData()].join(
					'\n',
				),
			),
		);
		for (const secret of [key, title, description, location, name, comment]) {
			expect(sent.filter((request) => request.includes(secret))).toEqual([]);
		}
	});
});
