/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/**
 * Drives the actual user-reported regressions against the operator's existing panels:
 *   - "main" panel with a button configured to navigate to "test2" (Require PIN ticked)
 *   - "test2" panel
 *   - "tablet" device token already minted
 *   - panel PIN = 1234
 *
 * Verifies:
 *   1. The "tablet" device token still works (after the controller change that drops the
 *      panelId scope check) — connecting to the "main" panel produces an open kiosk.
 *   2. Pressing the nav-configured button on "main" pops the PIN keypad (not silent nav).
 *   3. Typing 1234 navigates to "test2" successfully (no "invalid token or slug").
 *
 * The PIN setting was saved by the operator in the editor. This test only consumes it.
 */

const ASSUMED_PIN = '1234'

test('nav button on main → PIN 1234 → test2 works with tablet token', async ({ browser }) => {
	const editorCtx: BrowserContext = await browser.newContext({ viewport: { width: 900, height: 800 } })
	const editor: Page = await editorCtx.newPage()

	// --- Open editor, click "main" panel ---
	await editor.goto('/editor', { waitUntil: 'networkidle' })
	const mainEdit = editor
		.locator('.panel-list li', { has: editor.locator('.slug', { hasText: /\/panel\/main\b/ }) })
		.getByRole('button', { name: /^Edit$/ })
	await expect(mainEdit).toBeVisible({ timeout: 10_000 })
	await mainEdit.click()
	await expect(editor.locator('.toolbar .title')).toContainText(/main/i, { timeout: 10_000 })

	// --- Ensure the panel PIN is 1234. Idempotent: only save if the value actually changed
	// (a previous test run may have already persisted it). ---
	await editor.locator('.canvas').click({ position: { x: 10, y: 10 }, force: true })
	const pinInput = editor.getByTestId('panel-pin')
	await expect(pinInput).toBeVisible({ timeout: 5_000 })
	const currentPin = await pinInput.inputValue()
	if (currentPin !== ASSUMED_PIN) {
		await pinInput.fill('')
		await pinInput.fill(ASSUMED_PIN)
		const toolbarSave = editor.locator('.toolbar').getByRole('button', { name: /^Save$/ })
		await expect(toolbarSave).toBeEnabled({ timeout: 5_000 })
		await toolbarSave.click()
		await expect(editor.locator('.toolbar .title')).not.toContainText('●', { timeout: 10_000 })
	}

	// --- Open Devices, take the first device row, click QR, read URL ---
	await editor.getByRole('button', { name: /^Devices$/ }).click()
	const tabletRow = editor.locator('.token-row').first()
	await expect(tabletRow).toBeVisible({ timeout: 10_000 })
	await tabletRow.getByRole('button', { name: /^QR$/ }).click()

	// Force the "dev URL" tab so the URL is reachable from Vite (5174), not the prod backend.
	await editor.getByRole('button', { name: /^dev URL$/ }).click()
	const qrCode = editor.locator('.token-row code')
	const qrText = (await qrCode.first().textContent())!.trim()
	expect(qrText).toMatch(/\/panel\/main\?token=/)
	const kioskUrl = qrText

	// --- Open kiosk with tablet token ---
	const kioskCtx: BrowserContext = await browser.newContext({ viewport: { width: 1100, height: 800 } })
	const kiosk: Page = await kioskCtx.newPage()
	await kiosk.goto(kioskUrl + '&debug=1', { waitUntil: 'domcontentloaded' })

	const kioskCanvas = kiosk.getByTestId('kiosk-canvas')
	await expect(kioskCanvas).toBeVisible({ timeout: 15_000 })
	await expect(kioskCanvas, 'tablet token should connect to main kiosk').toHaveAttribute('data-status', 'open', {
		timeout: 15_000,
	})

	// --- Find the nav button on main. We don't know which item id it is, so we click each
	// button in turn and wait for either the PIN keypad to appear (success) or for nothing
	// to happen within a short window. The first button that pops the keypad is the nav one. ---
	const buttons = kiosk.locator('[data-item-kind="button"]')
	const buttonCount = await buttons.count()
	expect(buttonCount, 'main panel should have at least one button').toBeGreaterThan(0)

	const pinKeypad = kiosk.getByTestId('pin-keypad')
	let foundNavButton = false
	let urlChanged = false
	for (let i = 0; i < buttonCount; i++) {
		const urlBefore = kiosk.url()
		const btn = buttons.nth(i)
		const label = (await btn.innerText().catch(() => '')).trim().slice(0, 40)
		console.log(`[try] clicking button #${i} label="${label}"`)
		await btn.click()
		try {
			await expect(pinKeypad).toBeVisible({ timeout: 1500 })
			console.log(`[ok] PIN keypad appeared on button #${i}`)
			foundNavButton = true
			break
		} catch {
			// Either no PIN gate (silent nav) or a non-nav button
			await kiosk.waitForTimeout(400)
			if (kiosk.url() !== urlBefore) {
				console.log(`[bad] button #${i} navigated without PIN: ${kiosk.url()}`)
				urlChanged = true
				break
			}
		}
	}
	if (urlChanged) {
		throw new Error('button navigated without showing the PIN keypad — pin not persisted on panel?')
	}
	expect(foundNavButton, 'a button with Require PIN must pop the keypad').toBe(true)

	// --- Type 1234 via the keypad ---
	for (const d of ASSUMED_PIN) {
		await pinKeypad.getByRole('button', { name: d }).click()
	}

	// --- Verify navigation to test2 succeeded (URL changed, kiosk re-loaded, status open) ---
	await kiosk.waitForURL(/\/panel\/test2/, { timeout: 10_000 })
	await expect(kioskCanvas).toBeVisible({ timeout: 15_000 })
	await expect(kioskCanvas, 'tablet token should also unlock test2').toHaveAttribute('data-status', 'open', {
		timeout: 15_000,
	})

	// Hold both windows briefly so the user can confirm the result visually
	await kiosk.waitForTimeout(2000)

	await kioskCtx.close()
	await editorCtx.close()
})
