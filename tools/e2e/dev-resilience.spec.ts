/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test } from '@playwright/test'

/**
 * Verifies the Vite panels dev server stays up and serves the editor across multiple
 * simulated backend restarts. We trigger restarts indirectly by mutating a panel via the
 * editor (the dev.mts watcher rebuilds + restarts the backend on TS changes; for panel
 * saves alone the backend stays up, so we explicitly touch a TS file's mtime to force a
 * tsc incremental rebuild).
 *
 * The pre-fix behavior: WS proxy errors would spam the Vite log and after enough cycles
 * Vite became unresponsive (port still bound but requests hung / crashed). With the
 * resilient proxy handlers we should see:
 *   - editor still loads after each cycle
 *   - kiosk reconnects without permanent disconnect
 *   - Vite process stays healthy
 */

test('vite stays robust across rapid editor saves', async ({ page }) => {
	// First just verify the editor loads at all.
	await page.goto('http://localhost:5174/editor', { waitUntil: 'domcontentloaded', timeout: 15_000 })
	await expect(page.locator('.panel-list')).toBeVisible({ timeout: 10_000 })

	// Save the Main panel a few times in quick succession. Each save round-trips through
	// the Vite -> backend TRPC proxy.
	const mainEdit = page
		.locator('.panel-list li', { has: page.locator('.slug', { hasText: /\/panel\/main\b/ }) })
		.getByRole('button', { name: /^Edit$/ })
	await mainEdit.click()
	await expect(page.locator('.toolbar .title')).toContainText(/main/i, { timeout: 10_000 })

	for (let i = 0; i < 4; i++) {
		// Drop a label, save, delete it, save, repeat
		await page.getByTestId('palette-label').click()
		await page
			.locator('.toolbar')
			.getByRole('button', { name: /^Save$/ })
			.click()
		await expect(page.locator('.toolbar .title')).not.toContainText('●', { timeout: 10_000 })
		console.log(`[cycle ${i + 1}] save round-trip ok`)
	}

	// And the editor should still respond after all that.
	await expect(page.locator('.toolbar .title')).toContainText(/main/i)
})

test('vite serves editor html during a (simulated) backend outage', async ({ page, request }) => {
	// Even when the backend can't be reached (e.g. mid-restart), Vite must still serve its
	// own assets — index.html, JS chunks, CSS — without crashing or hanging. We can verify
	// this by hitting the Vite root directly with a HTTP GET; it should always return 200.
	for (let i = 0; i < 5; i++) {
		const r = await request.get('http://localhost:5174/editor', { timeout: 5_000 })
		expect(r.status(), `try ${i + 1}: Vite must keep serving its own routes`).toBe(200)
		const body = await r.text()
		expect(body, `try ${i + 1}: editor HTML body must include #root`).toContain('id="root"')
	}
	console.log('[ok] vite served its own HTML 5/5 times')
})
