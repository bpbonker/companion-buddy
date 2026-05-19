import path from 'node:path'
import reactPlugin from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, path.join(import.meta.dirname, '..'), '')

	const upstreamUrl =
		env.UPSTREAM_URL ?? (env.COMPANION_APP_PORT ? `localhost:${env.COMPANION_APP_PORT}` : 'localhost:8000')

	/**
	 * Swallow noisy proxy errors when the backend restarts during dev. Without this, every
	 * Companion TS rebuild produces a hundred-line ECONNREFUSED / ECONNRESET spam in the Vite
	 * log, and over time the unhandled-error events would destabilise the dev server. We log
	 * a single concise line per error category, throttled, and respond with a 503 on HTTP so
	 * the browser can simply retry.
	 */
	function attachResilientProxyHandlers(name: string) {
		// Per-route throttle: at most one "backend unavailable" line every 5 s per proxy.
		let lastLogged = 0
		const log = (msg: string) => {
			const now = Date.now()
			if (now - lastLogged < 5000) return
			lastLogged = now
			// eslint-disable-next-line no-console
			console.log(`[vite-proxy/${name}] ${msg}`)
		}
		return (proxy: import('http-proxy').default) => {
			proxy.on('error', (err: NodeJS.ErrnoException, _req, res) => {
				// ECONNREFUSED: backend isn't up (it's restarting).
				// ECONNRESET / EPIPE: backend dropped an in-flight connection on its way down.
				const code = err.code ?? err.name
				log(`upstream ${code}: backend transient, retrying client-side`)
				// HTTP responses: close politely with 503 so the browser retries without crashing the page.
				if (res && 'writeHead' in res && !res.headersSent) {
					try {
						;(res as import('http').ServerResponse).writeHead(503, { 'Content-Type': 'text/plain' })
						;(res as import('http').ServerResponse).end('upstream unavailable')
					} catch {
						/* socket already closed — nothing to do */
					}
				} else if (res && 'destroy' in res) {
					// WebSocket upgrades: tear down the socket cleanly so the browser's onclose fires
					// and our reconnect-with-backoff logic in PanelClient takes over.
					try {
						;(res as import('net').Socket).destroy()
					} catch {
						/* noop */
					}
				}
			})
			// Also bind to econnreset on the socket itself (some node versions don't surface it via 'error').
			proxy.on('econnreset', (err: Error) => log(`econnreset: ${err.message}`))
		}
	}

	return {
		base: '/',
		build: {
			outDir: 'build',
			sourcemap: true,
			chunkSizeWarningLimit: 1_000_000,
		},
		server: {
			port: parseInt(env.COMPANION_PANELS_PORT || '5174', 10),
			host: true,
			proxy: {
				'/trpc': {
					target: `ws://${upstreamUrl}`,
					ws: true,
					changeOrigin: true,
					configure: attachResilientProxyHandlers('trpc'),
				},
				'/panels-ws': {
					target: `ws://${upstreamUrl}`,
					ws: true,
					changeOrigin: true,
					configure: attachResilientProxyHandlers('panels-ws'),
				},
				'/panels-api': {
					target: `http://${upstreamUrl}`,
					changeOrigin: true,
					configure: attachResilientProxyHandlers('panels-api'),
				},
			},
		},
		plugins: [reactPlugin()],
	}
})
