import { test } from '@playwright/test'

test('debug: click Wall Panels from Companion sidebar', async ({ context }) => {
	const admin = await context.newPage()
	const reqs: string[] = []
	admin.on('request', (r) => reqs.push(`REQ ${r.method()} ${r.url()}`))
	admin.on('framenavigated', (f) => console.log(`NAV ${f.url()}`))
	admin.on('pageerror', (e) => console.log(`PAGEERROR ${e.message}`))
	admin.on('console', (m) => {
		if (m.type() === 'error' || m.type() === 'warning') {
			console.log(`[${m.type()}] ${m.text()}`)
		}
	})

	await admin.goto('http://localhost:8000/', { waitUntil: 'networkidle' })

	// Dismiss any open modal
	for (let i = 0; i < 3; i++) {
		const close = admin.locator('.modal.show .btn-close, .modal.show button:has-text("Close")').first()
		if (await close.isVisible().catch(() => false)) {
			await close.click().catch(() => {})
			await admin.waitForTimeout(300)
		} else break
	}

	// Find the Wall Panels link element and inspect its real DOM state
	const wpInfo = await admin.evaluate(() => {
		const all = Array.from(document.querySelectorAll('a, button'))
		const m = all.find((el) => el.textContent?.includes('Wall Panels'))
		if (!m) return { found: false }
		const a = m.closest('a') ?? (m.tagName === 'A' ? m : null)
		return {
			found: true,
			tag: m.tagName,
			anchor: a
				? {
						href: (a as HTMLAnchorElement).getAttribute('href'),
						hrefProp: (a as HTMLAnchorElement).href,
						target: (a as HTMLAnchorElement).getAttribute('target'),
						classList: a.className,
					}
				: null,
			outerHtml: m.outerHTML.slice(0, 800),
		}
	})
	console.log('Wall Panels DOM:', JSON.stringify(wpInfo, null, 2))

	// Try clicking it and wait for either a new page or a same-tab navigation
	const beforeUrl = admin.url()
	console.log('Before click URL:', beforeUrl)

	const newTab = context.waitForEvent('page', { timeout: 5000 }).catch(() => null)

	reqs.length = 0
	await admin
		.getByText('Wall Panels', { exact: false })
		.first()
		.click()
		.catch((e) => {
			console.log('click error:', e.message)
		})

	const np = await newTab
	if (np) {
		np.on('pageerror', (e) => console.log(`NEWTAB PAGEERROR ${e.message}`))
		np.on('console', (m) => {
			if (m.type() === 'error') console.log(`NEWTAB [${m.type()}] ${m.text()}`)
		})
		np.on('requestfailed', (r) =>
			console.log(`NEWTAB REQ FAILED: ${r.method()} ${r.url()} → ${r.failure()?.errorText}`)
		)
		await np.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
		await np.waitForTimeout(2000)
		console.log('NEW TAB opened at:', np.url())
		const body = await np.evaluate(() => document.body.innerText.slice(0, 500))
		console.log('NEW TAB body text:', body)
		const rootHtml = await np.evaluate(() => document.getElementById('root')?.innerHTML.slice(0, 400) ?? '(no root)')
		console.log('NEW TAB #root:', rootHtml)
		await np.screenshot({ path: 'test-results/wp-newtab.png' })
	} else {
		console.log('NO new tab opened.')
	}

	await admin.waitForTimeout(2000)
	console.log('Admin URL after click:', admin.url())

	console.log('\nRequests fired after click (first 30):')
	for (const r of reqs.slice(0, 30)) console.log('  ', r)

	await admin.screenshot({ path: 'test-results/wp-admin-after.png' })
})
