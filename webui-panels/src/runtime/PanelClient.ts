import type { Panel, PanelRuntimeClientMsg, PanelRuntimeServerMsg } from '@companion-app/shared/Model/PanelModel.js'

export type PanelClientStatus = 'connecting' | 'open' | 'reconnecting' | 'denied' | 'closed'

export interface PanelClientHandlers {
	onHello: (panel: Panel, snapshot: Record<string, unknown>) => void
	/** The operator saved this panel — apply the new layout in place, no reload needed. */
	onPanel?: (panel: Panel, snapshot: Record<string, unknown>) => void
	onVar: (name: string, value: unknown) => void
	onStatus: (status: PanelClientStatus, info?: string) => void
}

export class PanelClient {
	#ws: WebSocket | null = null
	#shutdown = false
	#reconnectMs = 1000
	#pingTimer: ReturnType<typeof setInterval> | null = null

	constructor(
		private slug: string,
		private token: string,
		private handlers: PanelClientHandlers
	) {}

	start() {
		this.#shutdown = false
		this.#connect()
	}

	stop() {
		this.#shutdown = true
		if (this.#pingTimer) {
			clearInterval(this.#pingTimer)
			this.#pingTimer = null
		}
		if (this.#ws) {
			try {
				this.#ws.close()
			} catch {
				/* noop */
			}
			this.#ws = null
		}
	}

	writeVar(itemId: string, varName: string, value: unknown) {
		this.#send({ type: 'writeVar', itemId, varName, value })
	}

	press(itemId: string, pressed: boolean) {
		this.#send({ type: 'press', itemId, pressed })
	}

	#send(msg: PanelRuntimeClientMsg) {
		if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) return
		try {
			this.#ws.send(JSON.stringify(msg))
		} catch (e) {
			console.warn('PanelClient send failed', e)
		}
	}

	#connect() {
		if (this.#shutdown) return
		const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
		const url = `${proto}//${window.location.host}/panels-ws?slug=${encodeURIComponent(this.slug)}&token=${encodeURIComponent(this.token)}`
		this.handlers.onStatus('connecting')
		const ws = new WebSocket(url)
		this.#ws = ws

		ws.addEventListener('open', () => {
			this.#reconnectMs = 1000
			this.handlers.onStatus('open')
			if (this.#pingTimer) clearInterval(this.#pingTimer)
			this.#pingTimer = setInterval(() => this.#send({ type: 'ping' }), 20_000)
		})

		ws.addEventListener('message', (e) => {
			let msg: PanelRuntimeServerMsg
			try {
				msg = JSON.parse(typeof e.data === 'string' ? e.data : '')
			} catch {
				return
			}
			switch (msg.type) {
				case 'hello':
					this.handlers.onHello(msg.panel, msg.snapshot)
					break
				case 'panel':
					this.handlers.onPanel?.(msg.panel, msg.snapshot)
					break
				case 'var':
					this.handlers.onVar(msg.name, msg.value)
					break
				case 'error':
					this.handlers.onStatus('denied', msg.message)
					break
				case 'ack':
					break
				case 'pong':
					break
			}
		})

		ws.addEventListener('close', (e) => {
			if (this.#pingTimer) {
				clearInterval(this.#pingTimer)
				this.#pingTimer = null
			}
			if (this.#shutdown) {
				this.handlers.onStatus('closed')
				return
			}
			// 4401 = token denied; do not reconnect
			if (e.code === 4401 || e.code === 4404) {
				this.handlers.onStatus('denied', e.reason || `code ${e.code}`)
				return
			}
			this.handlers.onStatus('reconnecting', `code ${e.code}`)
			setTimeout(() => this.#connect(), this.#reconnectMs)
			this.#reconnectMs = Math.min(this.#reconnectMs * 1.7, 15_000)
		})

		ws.addEventListener('error', () => {
			// close handler will follow
		})
	}
}
