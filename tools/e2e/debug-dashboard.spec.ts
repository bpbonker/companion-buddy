import { test } from '@playwright/test'

async function dump(label: string, page: import('@playwright/test').Page) {
	console.log(`\n========== ${label} ==========`)
	console.log('final URL:', page.url())
	console.log('title    :', await page.title())
	const txt = await page
		.locator('body')
		.innerText()
		.catch(() => '<no body>')
	console.log('body text (first 800 chars):')
	console.log(txt.slice(0, 800))
}

test('check both dashboards load', async ({ browser }) => {
	for (const target of [
		'http://127.0.0.1:8000/',
		'http://127.0.0.1:8000/connections',
		'http://127.0.0.1:8000/buttons',
		'http://127.0.0.1:8000/panels-ui/editor',
		'http://localhost:5174/editor',
	]) {
		const ctx = await browser.newContext()
		const page = await ctx.newPage()
		const consoleErrors: string[] = []
		const pageErrors: string[] = []
		const failedRequests: { url: string; status: number }[] = []
		page.on('console', (m) => {
			if (m.type() === 'error') consoleErrors.push(`[err] ${m.text()}`)
		})
		page.on('pageerror', (e) => pageErrors.push(`[pageerror] ${e.message}`))
		page.on('response', (r) => {
			if (r.status() >= 400 && !r.url().endsWith('.map')) failedRequests.push({ url: r.url(), status: r.status() })
		})
		try {
			await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15_000 })
			await page.waitForTimeout(2000)
		} catch (e: any) {
			console.log(`\n========== ${target} ==========`)
			console.log('goto FAILED:', e.message)
			await ctx.close()
			continue
		}
		await dump(target, page)
		if (consoleErrors.length) console.log('console errors:', consoleErrors.slice(0, 10))
		if (pageErrors.length) console.log('pageerrors:', pageErrors.slice(0, 10))
		if (failedRequests.length) {
			console.log('failed HTTP:')
			for (const r of failedRequests.slice(0, 8)) console.log(`  ${r.status}  ${r.url}`)
		}
		await ctx.close()
	}
})
