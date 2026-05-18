/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/**
 * Stress / regression suite covering the features added in this session against the
 * operator's existing panels. Uses the Main panel's first device token (the QR "dev URL").
 *
 * Coverage:
 *   1. Live push — three kiosks subscribe to Main; editor save propagates the new layout.
 *   2. PIN wrong then right — keypad shakes, then unlocks.
 *   3. Cross-panel nav with same token (regression of the original bug).
 *   4. Canvas-size width/height down arrow actually decrements (HTML step-grid bug).
 *   5. Knob vertical drag — value changes; horizontal-only drag does NOT flip across the dial.
 */

const PIN = '1234'

async function openMainEditor(page: Page) {
	await page.goto('/editor', { waitUntil: 'networkidle' })
	const mainEdit = page
		.locator('.panel-list li', { has: page.locator('.slug', { hasText: /\/panel\/main\b/ }) })
		.getByRole('button', { name: /^Edit$/ })
	await expect(mainEdit).toBeVisible({ timeout: 10_000 })
	await mainEdit.click()
	await expect(page.locator('.toolbar .title')).toContainText(/main/i, { timeout: 10_000 })
}

async function getMainKioskUrl(editor: Page): Promise<string> {
	await editor.getByRole('button', { name: /^Devices$/ }).click()
	const row = editor.locator('.token-row').first()
	await expect(row).toBeVisible({ timeout: 10_000 })
	await row.getByRole('button', { name: /^QR$/ }).click()
	await editor.getByRole('button', { name: /^dev URL$/ }).click()
	const code = editor.locator('.token-row code').first()
	const url = (await code.textContent())!.trim()
	expect(url).toMatch(/\/panel\/main\?token=/)
	// Close the dialog so subsequent interactions aren't blocked
	await editor
		.getByRole('button', { name: /^Close$/ })
		.click()
		.catch(() => undefined)
	return url
}

test.describe('stress', () => {
	test('live push: edit Main, two kiosks update without reconnect', async ({ browser }) => {
		const editorCtx: BrowserContext = await browser.newContext({ viewport: { width: 900, height: 800 } })
		const editor: Page = await editorCtx.newPage()
		await openMainEditor(editor)
		const url = await getMainKioskUrl(editor)

		// Spawn two kiosks. Three triggered an access-violation crash in Chromium on Windows
		// (suspected resource ceiling from running 4 browser contexts in one worker).
		const kioskCtxs: BrowserContext[] = []
		const kiosks: Page[] = []
		for (let i = 0; i < 2; i++) {
			const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } })
			const page = await ctx.newPage()
			await page.goto(url + '&debug=1', { waitUntil: 'domcontentloaded' })
			await expect(page.getByTestId('kiosk-canvas')).toHaveAttribute('data-status', 'open', { timeout: 15_000 })
			kioskCtxs.push(ctx)
			kiosks.push(page)
		}

		// Count current items on each kiosk
		const countBefore = await kiosks[0].locator('[data-item-kind]').count()

		// Add a new label item via the editor palette and save
		await editor.getByTestId('palette-label').click()
		await editor
			.locator('.toolbar')
			.getByRole('button', { name: /^Save$/ })
			.click()
		await expect(editor.locator('.toolbar .title')).not.toContainText('●', { timeout: 10_000 })

		// All three kiosks should reflect the increased item count via the live-push
		// 'panel' message — no reload, websocket stays open.
		for (const k of kiosks) {
			await expect(k.locator('[data-item-kind]')).toHaveCount(countBefore + 1, { timeout: 8_000 })
			await expect(k.getByTestId('kiosk-canvas'), 'kiosk should not have reconnected').toHaveAttribute(
				'data-status',
				'open'
			)
		}

		// We deliberately don't roll back the added label — the next live-push run will just see
		// one more item, which is fine. Avoids the brittle "find-and-click on a tiny item that
		// may be occluded by another control" cleanup loop.

		for (const ctx of kioskCtxs) await ctx.close()
		await editorCtx.close()
	})

	test('PIN wrong shakes, right unlocks nav to test2', async ({ browser }) => {
		const editorCtx = await browser.newContext({ viewport: { width: 900, height: 800 } })
		const editor = await editorCtx.newPage()
		await openMainEditor(editor)
		const url = await getMainKioskUrl(editor)

		const kioskCtx = await browser.newContext({ viewport: { width: 1100, height: 800 } })
		const kiosk = await kioskCtx.newPage()
		await kiosk.goto(url + '&debug=1', { waitUntil: 'domcontentloaded' })
		await expect(kiosk.getByTestId('kiosk-canvas')).toHaveAttribute('data-status', 'open', { timeout: 15_000 })

		// Find the nav button (the one that opens the keypad)
		const buttons = kiosk.locator('[data-item-kind="button"]')
		const buttonCount = await buttons.count()
		const pinKeypad = kiosk.getByTestId('pin-keypad')
		let foundNav = false
		for (let i = 0; i < buttonCount; i++) {
			await buttons.nth(i).click()
			try {
				await expect(pinKeypad).toBeVisible({ timeout: 1200 })
				foundNav = true
				break
			} catch {
				// not this one
			}
		}
		expect(foundNav, 'a Require-PIN+Navigate button must exist on Main').toBe(true)

		// Type WRONG PIN → keypad should reset (entered length back to 0) and stay visible.
		for (const d of '9999') {
			await pinKeypad.getByRole('button', { name: d }).click()
		}
		// Wait for the shake reset (350ms in PinKeypad)
		await kiosk.waitForTimeout(500)
		await expect(pinKeypad, 'keypad must stay open after wrong PIN').toBeVisible()

		// Type the correct PIN
		for (const d of PIN) {
			await pinKeypad.getByRole('button', { name: d }).click()
		}
		await kiosk.waitForURL(/\/panel\/test2/, { timeout: 10_000 })
		await expect(kiosk.getByTestId('kiosk-canvas')).toHaveAttribute('data-status', 'open', { timeout: 15_000 })

		await kioskCtx.close()
		await editorCtx.close()
	})

	test('canvas size width down-arrow decrements', async ({ page }) => {
		await openMainEditor(page)
		// Editor opens with nothing selected → panel-level Inspector is shown → canvas-width is visible.
		const widthInput = page.getByTestId('canvas-width')
		await expect(widthInput).toBeVisible({ timeout: 5_000 })

		const before = Number(await widthInput.inputValue())
		// Press the keyboard down arrow — should step by cellPx
		await widthInput.focus()
		await widthInput.press('ArrowDown')
		// Wait a tick for React to re-render with new state
		await page.waitForTimeout(150)
		const after = Number(await widthInput.inputValue())
		expect(after, `ArrowDown should decrease width (before=${before}, after=${after})`).toBeLessThan(before)

		// Now press ArrowUp twice to ensure we end up back AT or ABOVE the start (no orphan state)
		await widthInput.press('ArrowUp')
		await widthInput.press('ArrowUp')
		await page.waitForTimeout(150)
		const final = Number(await widthInput.inputValue())
		expect(final, 'ArrowUp must increase past start after one decrement').toBeGreaterThanOrEqual(before)

		// Don't save — leave the panel untouched
		await page.reload()
	})

	test('knob vertical drag changes value; horizontal drag does not flip range', async ({ browser }) => {
		const editorCtx = await browser.newContext({ viewport: { width: 900, height: 800 } })
		const editor = await editorCtx.newPage()
		await openMainEditor(editor)

		// Need a knob on Main. If there isn't one, skip — the operator's panel may not have it.
		const hasKnob = (await editor.locator('[data-item-kind="knob"]').count()) > 0
		test.skip(!hasKnob, 'Main panel has no knob — skipping knob stress test')

		const url = await getMainKioskUrl(editor)
		const kioskCtx = await browser.newContext({ viewport: { width: 1100, height: 800 } })
		const kiosk = await kioskCtx.newPage()
		await kiosk.goto(url + '&debug=1', { waitUntil: 'domcontentloaded' })
		await expect(kiosk.getByTestId('kiosk-canvas')).toHaveAttribute('data-status', 'open', { timeout: 15_000 })

		const knob = kiosk.locator('[data-item-kind="knob"]').first()
		const box = (await knob.boundingBox())!
		const cx = box.x + box.width / 2
		const cy = box.y + box.height / 2

		// Horizontal-only drag: in the new design this should be IGNORED (no value change).
		// We can't read the value directly without binding, but the SVG fill-arc's dasharray length
		// reflects current pct. Capture before & after.
		const arc = knob.locator('svg circle').nth(1)
		const dashBefore = await arc.getAttribute('stroke-dasharray')

		await kiosk.mouse.move(cx - 40, cy)
		await kiosk.mouse.down()
		for (let i = -40; i <= 40; i += 8) await kiosk.mouse.move(cx + i, cy)
		await kiosk.mouse.up()
		await kiosk.waitForTimeout(200)
		const dashHorizontal = await arc.getAttribute('stroke-dasharray')
		expect(dashHorizontal, 'horizontal drag must not change value').toBe(dashBefore)

		const parseFill = (d: string | null) => Number((d ?? '0 0').trim().split(/\s+/)[0])

		// Drag DOWN first — should DECREASE the value. Lowers it off of whatever ceiling
		// the var happens to sit at, so the subsequent upward drag has room to grow.
		await kiosk.mouse.move(cx, cy - 60)
		await kiosk.mouse.down()
		for (let i = -60; i <= 140; i += 10) await kiosk.mouse.move(cx, cy + i)
		await kiosk.mouse.up()
		await kiosk.waitForTimeout(200)
		const dashAfterDown = await arc.getAttribute('stroke-dasharray')
		expect(parseFill(dashAfterDown), 'vertical drag down must decrease fill').toBeLessThan(parseFill(dashBefore))

		// Now UP — should INCREASE again
		await kiosk.mouse.move(cx, cy + 60)
		await kiosk.mouse.down()
		for (let i = 60; i >= -140; i -= 10) await kiosk.mouse.move(cx, cy + i)
		await kiosk.mouse.up()
		await kiosk.waitForTimeout(200)
		const dashAfterUp = await arc.getAttribute('stroke-dasharray')
		expect(parseFill(dashAfterUp), 'vertical drag up must increase fill').toBeGreaterThan(parseFill(dashAfterDown))

		await kioskCtx.close()
		await editorCtx.close()
	})
})
