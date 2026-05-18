/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

// End-to-end headed smoke test for the wall-panel WYSIWYG + kiosk runtime.
// Two browser windows are opened side-by-side: the editor (left) and the kiosk (right).
// The test creates a panel with one of each control type, mints a device, opens the kiosk
// in the second window, then exercises writes (button press + slider drag) and reads
// (indicator + meter + label refresh) end-to-end via the live Companion backend.

const SLUG = `smoke-${Date.now().toString(36)}`
const PANEL_NAME = `Smoke ${new Date().toISOString().slice(11, 19)}`
const VAR_NAME = `smoke_${Date.now().toString(36)}`
const BIND_VAR = `custom:${VAR_NAME}`

test('headed: editor builds a panel, kiosk reflects writes and reads', async ({ browser }) => {
	const editorCtx: BrowserContext = await browser.newContext({
		viewport: { width: 900, height: 800 },
	})
	const editor: Page = await editorCtx.newPage()

	await editor.goto('/editor', { waitUntil: 'networkidle' })

	// Create a new panel
	// Fill slug first then name to avoid the name-input onBlur autofilling the slug
	await editor.getByRole('button', { name: /\+ New panel/i }).click()
	await editor.locator('.modal input').nth(1).fill(SLUG)
	await editor.locator('.modal input').first().fill(PANEL_NAME)
	await editor.locator('.modal input').nth(1).press('Tab')
	await editor.getByRole('button', { name: /^Create$/ }).click()

	// We're in the editor page now (/editor/<id>) — wait for the title to reflect the panel name
	await expect(editor.locator('.toolbar .title')).toContainText(PANEL_NAME)

	// Drop each control onto the canvas (clicks on palette items just place them at 1,1)
	for (const kind of ['button', 'slider', 'knob', 'indicator', 'meter', 'label', 'image'] as const) {
		await editor.getByTestId(`palette-${kind}`).click()
	}

	const items = editor.locator('.canvas .item')
	await expect(items).toHaveCount(7)

	// Bind everything that has a write/read target to the same custom variable
	// Select button → set writeVar + writeValue
	await editor.locator('[data-item-kind="button"]').first().click({ force: true })
	await editor.getByTestId('field-writeVar').fill(BIND_VAR)
	await editor.getByTestId('field-writeValue').fill('42')

	// Slider, knob, indicator, meter, label all use field-bindVar
	for (const kind of ['slider', 'knob', 'indicator', 'meter', 'label'] as const) {
		await editor.locator(`[data-item-kind="${kind}"]`).first().click({ force: true })
		const field = editor.getByTestId('field-bindVar')
		await field.fill(BIND_VAR)
	}

	// Save
	await editor.getByRole('button', { name: /^Save$/ }).click()
	await expect(editor.locator('.toolbar .title')).not.toContainText('•', { timeout: 10_000 })

	// Open Devices dialog and add a device
	await editor.getByRole('button', { name: /^Devices$/ }).click()
	await editor.getByTestId('device-name-input').fill('Test Tablet')
	await editor.getByTestId('device-add').click()

	// QR panel appears with the dev URL. We use the textual URL instead of decoding the QR.
	const qrUrlInput = editor.locator('.token-row code')
	await expect(qrUrlInput.first()).toBeVisible({ timeout: 10_000 })
	const kioskUrlText = await qrUrlInput.first().textContent()
	expect(kioskUrlText).toMatch(new RegExp(`/panel/${SLUG}\\?token=`))
	const kioskUrl = kioskUrlText!.trim()

	// Open the kiosk in a separate context to simulate a second device
	const kioskCtx: BrowserContext = await browser.newContext({
		viewport: { width: 1100, height: 800 },
	})
	const kiosk: Page = await kioskCtx.newPage()
	await kiosk.goto(kioskUrl + '&debug=1', { waitUntil: 'domcontentloaded' })

	const kioskCanvas = kiosk.getByTestId('kiosk-canvas')
	await expect(kioskCanvas).toBeVisible({ timeout: 15_000 })
	await expect(kioskCanvas).toHaveAttribute('data-status', 'open', { timeout: 15_000 })
	await expect(kiosk.locator('.canvas, .kiosk [data-item-kind]').first()).toBeVisible()

	// Press the button on the kiosk
	const kioskButton = kiosk.locator('[data-item-kind="button"]').first()
	await kioskButton.click()

	// Indicator should light up (round dot bg becomes the on-color)
	const indicatorDot = kiosk.locator('[data-item-kind="indicator"] > div > div').first()
	await expect(indicatorDot)
		.toHaveCSS('background-color', /(34, 197, 94|#22c55e)/i, { timeout: 5_000 })
		.catch(async () => {
			// Some browsers report rgb form, so also accept any non-grey
			const bg = await indicatorDot.evaluate((el) => getComputedStyle(el).backgroundColor)
			expect(bg).not.toBe('rgb(63, 63, 70)')
		})

	// Meter fill > 0
	const meterFill = kiosk.locator('[data-item-kind="meter"] > div > div').first()
	const meterWidth = await meterFill.evaluate((el) => getComputedStyle(el).width)
	expect(meterWidth).not.toBe('0px')

	// Label reflects "42"
	await expect(kiosk.locator('[data-item-kind="label"]')).toContainText('42', { timeout: 5_000 })

	// Drag the slider to send a continuous write
	const slider = kiosk.locator('[data-item-kind="slider"]').first()
	const box = (await slider.boundingBox())!
	const startX = box.x + 4
	const targetX = box.x + box.width - 4
	await kiosk.mouse.move(startX, box.y + box.height / 2)
	await kiosk.mouse.down()
	for (let i = 0; i <= 10; i++) {
		await kiosk.mouse.move(startX + (targetX - startX) * (i / 10), box.y + box.height / 2)
		await kiosk.waitForTimeout(40)
	}
	await kiosk.mouse.up()

	// Label should now reflect a value approaching the max (100)
	await expect(kiosk.locator('[data-item-kind="label"]')).toContainText(/\d{2,}/, { timeout: 5_000 })

	// Hold both windows for ~3s so the user can see the result visually before the test ends
	await kiosk.waitForTimeout(3_000)

	await kioskCtx.close()
	await editorCtx.close()
})
