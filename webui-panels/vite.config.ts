import path from 'node:path'
import reactPlugin from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, path.join(import.meta.dirname, '..'), '')

	const upstreamUrl =
		env.UPSTREAM_URL ?? (env.COMPANION_APP_PORT ? `localhost:${env.COMPANION_APP_PORT}` : 'localhost:8000')

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
				},
				'/panels-ws': {
					target: `ws://${upstreamUrl}`,
					ws: true,
					changeOrigin: true,
				},
				'/panels-api': {
					target: `http://${upstreamUrl}`,
					changeOrigin: true,
				},
			},
		},
		plugins: [reactPlugin()],
	}
})
