import type { Panel, PanelToken } from '@companion-app/shared/Model/PanelModel.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'

export class PanelStore {
	readonly #panels: DataStoreTableView<Record<string, Panel>>
	readonly #tokens: DataStoreTableView<Record<string, PanelToken>>
	readonly #settings: DataStoreTableView<Record<string, string>>

	constructor(db: DataDatabase) {
		this.#panels = db.getTableView<Record<string, Panel>>('panels')
		this.#tokens = db.getTableView<Record<string, PanelToken>>('panel_tokens')
		this.#settings = db.getTableView<Record<string, string>>('panel_settings')
	}

	getSetting(key: string): string | undefined {
		return this.#settings.getPrimitiveOrDefault(key, '') || undefined
	}

	setSetting(key: string, value: string | null): void {
		if (value === null || value === '') {
			this.#settings.delete(key)
		} else {
			this.#settings.setPrimitive(key, value)
		}
	}

	listPanels(): Panel[] {
		return Object.values(this.#panels.all())
	}

	getPanel(id: string): Panel | undefined {
		return this.#panels.get(id)
	}

	getPanelBySlug(slug: string): Panel | undefined {
		const all = this.#panels.all()
		for (const p of Object.values(all)) {
			if (p && p.slug === slug) return p
		}
		return undefined
	}

	upsertPanel(panel: Panel): void {
		this.#panels.set(panel.id, panel)
	}

	deletePanel(id: string): void {
		this.#panels.delete(id)
		// cascade-delete tokens for this panel
		const all = this.#tokens.all()
		for (const [token, t] of Object.entries(all)) {
			if (t && t.panelId === id) this.#tokens.delete(token)
		}
	}

	listTokensForPanel(panelId: string): PanelToken[] {
		const all = this.#tokens.all()
		return Object.values(all).filter((t): t is PanelToken => !!t && t.panelId === panelId)
	}

	/**
	 * All tokens on this instance, including instance-wide ones (with no panelId) and
	 * legacy panel-scoped tokens. Used by the Devices UI now that one device can drive
	 * any panel via nav buttons.
	 */
	listAllTokens(): PanelToken[] {
		const all = this.#tokens.all()
		return Object.values(all).filter((t): t is PanelToken => !!t)
	}

	getToken(token: string): PanelToken | undefined {
		return this.#tokens.get(token)
	}

	upsertToken(token: PanelToken): void {
		this.#tokens.set(token.token, token)
	}

	deleteToken(token: string): void {
		this.#tokens.delete(token)
	}

	updateTokenSeen(token: string, userAgent: string | undefined): void {
		const existing = this.getToken(token)
		if (!existing) return
		this.upsertToken({ ...existing, lastSeenAt: Date.now(), lastUserAgent: userAgent })
	}
}
