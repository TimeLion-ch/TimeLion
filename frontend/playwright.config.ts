import { defineConfig, devices } from '@playwright/test';

/** Not 8000, so that the tests never run against `composer serve` and its database. */
const port = 8123;

export default defineConfig({
	testDir: 'e2e',
	forbidOnly: !!process.env.CI,
	// One PHP process and one SQLite file: the tests run one after another.
	workers: 1,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://127.0.0.1:${port}`,
		locale: 'en-GB',
		timezoneId: 'Europe/Zurich',
		trace: 'retain-on-failure',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `node e2e/server.mjs ${port}`,
		url: `http://127.0.0.1:${port}/api/health`,
		reuseExistingServer: false,
		stdout: 'pipe',
		stderr: 'pipe',
	},
});
