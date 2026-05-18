import { expect, test } from '@playwright/test'

test('open panel editor', async ({ page }) => {
	const errors: string[] = []
	page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}\n${err.stack ?? ''}`))
	page.on('console', (msg) => {
		const text = msg.text()
		if (msg.type() === 'error' && !text.includes('Failed to load resource')) {
			errors.push(`[console.error] ${text}`)
		}
		if (msg.type() === 'warning') errors.push(`[console.warn] ${text}`)
	})
	page.on('requestfailed', (req) =>
		errors.push(`[requestfailed] ${req.method()} ${req.url()} → ${req.failure()?.errorText}`)
	)

	await page.goto('/editor', { waitUntil: 'networkidle' })
	await page.waitForTimeout(1_000)

	// Click first Edit button
	const editButtons = page.getByRole('button', { name: 'Edit' })
	const count = await editButtons.count()
	console.log('edit buttons found:', count)
	if (count === 0) {
		console.log('No panels exist — creating one first')
		await page.getByRole('button', { name: /\+ New panel/ }).click()
		await page.locator('.modal input').nth(1).fill('test-loaded')
		await page.locator('.modal input').first().fill('Loaded Test')
		await page.locator('.modal input').nth(1).press('Tab')
		await page.getByRole('button', { name: /^Create$/ }).click()
	} else {
		await editButtons.first().click()
	}

	await page.waitForTimeout(3_000)

	const url = page.url()
	console.log('current URL:', url)

	const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1200))
	console.log('--- body text after open ---')
	console.log(bodyText)
	console.log('--- end ---')

	const visibleHosts = await page.evaluate(() => {
		const els = document.querySelectorAll('.toolbar, .editor-layout, .canvas, .palette, .inspector')
		return Array.from(els).map((el) => ({
			cls: el.className,
			visible: (el as HTMLElement).offsetWidth > 0 && (el as HTMLElement).offsetHeight > 0,
		}))
	})
	console.log('top-level elements visible:', JSON.stringify(visibleHosts, null, 2))

	console.log('--- errors / warnings captured ---')
	for (const e of errors) console.log(e)
	console.log('--- end errors ---')

	await page.screenshot({ path: 'test-results/editor-open.png', fullPage: true })

	expect(errors.filter((e) => e.startsWith('[pageerror]') || e.startsWith('[requestfailed]'))).toEqual([])
})
