import { randomBytes } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { networkInterfaces } from 'node:os'
import type { Duplex } from 'node:stream'
import { nanoid } from 'nanoid'
import { WebSocketServer, type WebSocket } from 'ws'
import { z } from 'zod'
import {
	NewPanelInputSchema,
	PanelGridSchema,
	PanelItemSchema,
	PanelSchema,
	UpdatePanelInputSchema,
	type Panel,
	type PanelDeviceSummary,
	type PanelSummary,
} from '@companion-app/shared/Model/PanelModel.js'
import type { DataDatabase } from '../Data/Database.js'
import LogController from '../Log/Controller.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import type { VariablesController } from '../Variables/Controller.js'
import { PanelRuntimeSession } from './Runtime.js'
import { PanelStore } from './Store.js'

export class PanelsController {
	readonly #logger = LogController.createLogger('Panels/Controller')
	readonly #store: PanelStore
	readonly #variables: VariablesController
	readonly #wss = new WebSocketServer({ noServer: true })
	readonly #sessions = new Set<PanelRuntimeSession>()

	constructor(db: DataDatabase, variables: VariablesController) {
		this.#store = new PanelStore(db)
		this.#variables = variables

		this.#variables.values.on('variables_changed', (changed) => {
			if (this.#sessions.size === 0) return
			for (const session of this.#sessions) {
				try {
					session.handleVariablesChanged(changed)
				} catch (e) {
					this.#logger.silly(`session push failed: ${e}`)
				}
			}
		})
	}

	/**
	 * Express-style upgrade handler. Returns true if it claimed the upgrade.
	 */
	handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
		const url = req.url ?? ''
		if (!url.startsWith('/panels-ws')) return false

		const params = new URL(url, 'http://placeholder.local').searchParams
		const slug = params.get('slug') ?? ''
		const token = params.get('token') ?? ''

		const panel = slug ? this.#store.getPanelBySlug(slug) : undefined
		const tokenRow = token ? this.#store.getToken(token) : undefined

		// Tokens are instance-wide on this deployment — any valid token grants access to any
		// panel by slug. Legacy tokens that happen to carry a panelId are accepted everywhere too
		// (the field is treated as informational, not a scope).
		if (!panel || !tokenRow) {
			this.#wss.handleUpgrade(req, socket, head, (ws) => {
				try {
					ws.close(4401, 'invalid token or slug')
				} catch {
					/* noop */
				}
			})
			return true
		}

		this.#wss.handleUpgrade(req, socket, head, (ws) => {
			this.#store.updateTokenSeen(token, req.headers['user-agent'])
			this.#acceptSession(ws, panel, token)
		})
		return true
	}

	#acceptSession(ws: WebSocket, panel: Panel, token: string): void {
		const session = new PanelRuntimeSession(ws, panel, token, this.#variables)
		this.#sessions.add(session)

		ws.on('message', (data) => {
			try {
				// data is Buffer | ArrayBuffer | Buffer[] per ws's RawData; normalize to a string.
				const text = Array.isArray(data)
					? Buffer.concat(data).toString('utf8')
					: Buffer.isBuffer(data)
						? data.toString('utf8')
						: Buffer.from(data).toString('utf8')
				session.handleClientMessage(text)
			} catch (e) {
				this.#logger.silly(`message handler error: ${e}`)
			}
		})
		ws.on('close', () => {
			this.#sessions.delete(session)
		})
		ws.on('error', () => {
			this.#sessions.delete(session)
		})

		session.sendHello()
	}

	/**
	 * Push a freshly-saved panel to every connected kiosk that's running it.
	 * Lets a venue full of tablets pick up edits the instant the operator clicks Save.
	 */
	pushPanelUpdate(panel: Panel): void {
		for (const session of this.#sessions) {
			if (session.panelId !== panel.id) continue
			try {
				session.applyPanelUpdate(panel)
			} catch (e) {
				this.#logger.silly(`push panel update failed: ${e}`)
			}
		}
	}

	/**
	 * If a token is revoked while connected, this drops the session.
	 */
	revokeAllSessionsForToken(token: string): void {
		for (const session of this.#sessions) {
			if (session.token === token) {
				session.close(4401, 'token revoked')
				this.#sessions.delete(session)
			}
		}
	}

	/**
	 * If a panel is deleted, drop all its sessions. Matches by session.panelId so it works
	 * regardless of whether the session is on a legacy panel-scoped token or an instance-wide one.
	 */
	revokeAllSessionsForPanel(panelId: string): void {
		for (const session of this.#sessions) {
			if (session.panelId === panelId) {
				session.close(4404, 'panel deleted')
				this.#sessions.delete(session)
			}
		}
	}

	createTrpcRouter() {
		const self = this
		return router({
			list: publicProcedure.query((): PanelSummary[] => {
				// Venue-wide device count — every panel reports the same number, since any
				// device can drive any panel via nav buttons.
				const deviceCount = self.#store.listAllTokens().length
				return self.#store.listPanels().map((p) => ({
					id: p.id,
					slug: p.slug,
					name: p.name,
					itemCount: p.items.length,
					tokenCount: deviceCount,
					updatedAt: p.updatedAt,
				}))
			}),

			get: publicProcedure.input(z.object({ id: z.string() })).query(({ input }): Panel | null => {
				return self.#store.getPanel(input.id) ?? null
			}),

			create: publicProcedure.input(NewPanelInputSchema).mutation(({ input }): Panel => {
				if (self.#store.getPanelBySlug(input.slug)) {
					throw new Error(`Slug "${input.slug}" is already taken`)
				}
				const now = Date.now()
				const grid = PanelGridSchema.parse(input.grid ?? {})
				const panel: Panel = {
					id: nanoid(10),
					slug: input.slug,
					name: input.name,
					grid,
					theme: 'studio-dark',
					frame: false,
					items: [],
					createdAt: now,
					updatedAt: now,
				}
				self.#store.upsertPanel(panel)
				return panel
			}),

			save: publicProcedure.input(UpdatePanelInputSchema).mutation(({ input }): Panel => {
				const existing = self.#store.getPanel(input.id)
				if (!existing) throw new Error(`Panel ${input.id} not found`)
				if (input.slug && input.slug !== existing.slug && self.#store.getPanelBySlug(input.slug)) {
					throw new Error(`Slug "${input.slug}" is already taken`)
				}
				const items = input.items ? input.items.map((i) => PanelItemSchema.parse(i)) : existing.items
				const next: Panel = PanelSchema.parse({
					...existing,
					...(input.name !== undefined ? { name: input.name } : {}),
					...(input.slug !== undefined ? { slug: input.slug } : {}),
					...(input.grid !== undefined ? { grid: input.grid } : {}),
					...(input.theme !== undefined ? { theme: input.theme } : {}),
					...(input.accentColor !== undefined ? { accentColor: input.accentColor ?? undefined } : {}),
					...(input.bgColor !== undefined ? { bgColor: input.bgColor ?? undefined } : {}),
					...(input.frame !== undefined ? { frame: input.frame } : {}),
					...(input.pin !== undefined ? { pin: input.pin ?? undefined } : {}),
					items,
					updatedAt: Date.now(),
				})
				self.#store.upsertPanel(next)
				self.pushPanelUpdate(next)
				return next
			}),

			delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ input }) => {
				self.revokeAllSessionsForPanel(input.id)
				self.#store.deletePanel(input.id)
				return { ok: true as const }
			}),

			networkInterfaces: publicProcedure.query((): Array<{ iface: string; address: string }> => {
				const result: Array<{ iface: string; address: string }> = []
				try {
					const ifaces = networkInterfaces()
					for (const [iface, addrs] of Object.entries(ifaces)) {
						for (const a of addrs ?? []) {
							if (a.family === 'IPv4' && !a.internal) {
								result.push({ iface, address: a.address })
							}
						}
					}
				} catch {
					/* return whatever we got */
				}
				return result
			}),

			settings: router({
				getKioskHost: publicProcedure.query((): { host: string | null } => {
					return { host: self.#store.getSetting('kioskHost') ?? null }
				}),
				setKioskHost: publicProcedure.input(z.object({ host: z.string().nullable() })).mutation(({ input }) => {
					// Normalize: strip trailing slash; accept "host:port" or full origin
					let v = (input.host ?? '').trim()
					v = v.replace(/\/+$/, '')
					self.#store.setSetting('kioskHost', v)
					return { ok: true as const, host: v || null }
				}),
			}),

			tokens: router({
				list: publicProcedure.input(z.object({ panelId: z.string() })).query((): PanelDeviceSummary[] => {
					// Devices are venue-wide now (one token, all panels). The panelId input is
					// preserved for API stability but ignored — every device shows up in every
					// panel's Devices dialog.
					return self.#store.listAllTokens().map((t) => ({
						token: t.token,
						label: t.label,
						createdAt: t.createdAt,
						lastSeenAt: t.lastSeenAt,
						lastUserAgent: t.lastUserAgent,
					}))
				}),

				mint: publicProcedure
					.input(z.object({ panelId: z.string(), label: z.string().min(1) }))
					.mutation(({ input }) => {
						// panelId is kept in the input for API stability with the existing UI, but
						// new tokens are minted instance-wide (no panelId) so a single device can be
						// switched between panels via nav buttons without re-pairing.
						const panel = self.#store.getPanel(input.panelId)
						if (!panel) throw new Error(`Panel ${input.panelId} not found`)
						const token = randomBytes(24).toString('base64url')
						self.#store.upsertToken({
							token,
							label: input.label,
							createdAt: Date.now(),
						})
						return { token, label: input.label }
					}),

				revoke: publicProcedure.input(z.object({ panelId: z.string(), token: z.string() })).mutation(({ input }) => {
					// panelId left in for API stability; tokens are venue-wide so revoking
					// just needs the token itself. Sessions across all panels are dropped.
					const t = self.#store.getToken(input.token)
					if (t) {
						self.#store.deleteToken(input.token)
						self.revokeAllSessionsForToken(input.token)
					}
					return { ok: true as const }
				}),
			}),
		})
	}

	close(): void {
		for (const session of this.#sessions) {
			session.close(1001, 'shutdown')
		}
		this.#sessions.clear()
		this.#wss.close()
	}
}
