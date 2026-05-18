import { defineConfig } from '@playwright/test'

const HEADED = process.env.HEADED !== '0'

export default defineConfig({
	testDir: './tools/e2e',
	timeout: 90_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	workers: 1,
	reporter: [['list']],
	use: {
		baseURL: 'http://localhost:5174',
		headless: !HEADED,
		viewport: { width: 1366, height: 800 },
		launchOptions: {
			slowMo: HEADED ? 120 : 0,
			args: ['--window-size=1380,860', '--window-position=80,80'],
		},
		ignoreHTTPSErrors: true,
		trace: 'retain-on-failure',
		video: 'off',
	},
	projects: [
		{
			name: 'chromium',
			use: { browserName: 'chromium' },
		},
	],
})
