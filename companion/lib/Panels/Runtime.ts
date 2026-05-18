import type { WebSocket } from 'ws'
import type { Panel, PanelRuntimeClientMsg, PanelRuntimeServerMsg } from '@companion-app/shared/Model/PanelModel.js'
import LogController from '../Log/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'

/**
 * One-per-websocket session for a kiosk-mode panel.
 *
 * Trust model: token is validated before the session is constructed.
 * The session is allowed to write to variables under the `custom` label only;
 * any other writeVar request is rejected.
 */
export class PanelRuntimeSession {
	readonly #logger = LogController.createLogger('Panels/Runtime')
	readonly #ws: WebSocket
	readonly #variables: VariablesController
	#boundVars: Set<string>
	#panel: Panel
	readonly #token: string

	constructor(ws: WebSocket, panel: Panel, token: string, variables: VariablesController) {
		this.#ws = ws
		this.#panel = panel
		this.#token = token
		this.#variables = variables
		this.#boundVars = collectBoundVars(panel)
	}

	get token(): string {
		return this.#token
	}

	get panelId(): string {
		return this.#panel.id
	}

	get boundVars(): ReadonlySet<string> {
		return this.#boundVars
	}

	sendHello(): void {
		this.#send({ type: 'hello', panel: this.#panel, snapshot: this.#buildSnapshot() })
	}

	/**
	 * Operator just saved this panel in the editor — swap our in-memory panel and tell the kiosk.
	 * The kiosk applies the new layout/items without losing its websocket. The fresh snapshot
	 * is needed because newly-bound variables may not have been streamed before.
	 */
	applyPanelUpdate(panel: Panel): void {
		if (panel.id !== this.#panel.id) return
		this.#panel = panel
		this.#boundVars = collectBoundVars(panel)
		this.#send({ type: 'panel', panel: this.#panel, snapshot: this.#buildSnapshot() })
	}

	#buildSnapshot(): Record<string, unknown> {
		const snapshot: Record<string, unknown> = {}
		for (const fqn of this.#boundVars) {
			const v = this.#readByFqn(fqn)
			if (v !== undefined) snapshot[fqn] = v
		}
		return snapshot
	}

	handleVariablesChanged(changed: ReadonlySet<string>): void {
		for (const fqn of changed) {
			if (!this.#boundVars.has(fqn)) continue
			const value = this.#readByFqn(fqn)
			this.#send({ type: 'var', name: fqn, value: value ?? null })
		}
	}

	handleClientMessage(raw: string): void {
		let msg: PanelRuntimeClientMsg
		try {
			msg = JSON.parse(raw)
		} catch {
			return
		}
		switch (msg.type) {
			case 'writeVar':
				this.#handleWriteVar(msg.varName, msg.value, msg.itemId)
				break
			case 'press':
				// reserved for future "fire action" feature
				this.#send({ type: 'ack', itemId: msg.itemId })
				break
			case 'ping':
				this.#send({ type: 'pong' })
				break
		}
	}

	close(code: number, reason: string): void {
		try {
			this.#ws.close(code, reason)
		} catch {
			/* noop */
		}
	}

	#handleWriteVar(varName: string, value: unknown, itemId: string): void {
		const parts = varName.split(':')
		if (parts.length !== 2) {
			this.#send({ type: 'error', message: `Invalid var name "${varName}"` })
			return
		}
		const [label, name] = parts
		// Only custom-label writes are allowed; internal:custom_X is rewritten.
		let targetName = name
		if (label === 'internal' && name.startsWith('custom_')) {
			targetName = name.slice('custom_'.length)
		} else if (label !== 'custom') {
			this.#send({ type: 'error', message: `writeVar only supported for custom:* (got ${label}:${name})` })
			return
		}

		const v = coerceVariableValue(value)
		let err = this.#variables.custom.setValue(targetName, v)
		if (err === 'Unknown name') {
			// Auto-create the custom variable on first write to give a frictionless first-run experience.
			const initial = typeof v === 'string' ? v : String(v ?? '')
			const createErr = this.#variables.custom.createVariable(targetName, initial)
			if (createErr) {
				this.#send({ type: 'error', message: `createVariable: ${createErr}` })
				return
			}
			err = this.#variables.custom.setValue(targetName, v)
		}
		if (err) {
			this.#send({ type: 'error', message: `setValue: ${err}` })
			return
		}
		this.#send({ type: 'ack', itemId })
	}

	#readByFqn(fqn: string): unknown {
		const [label, name] = fqn.split(':', 2)
		if (!label || !name) return undefined
		return this.#variables.values.getVariableValue(label, name)
	}

	#send(msg: PanelRuntimeServerMsg): void {
		if (this.#ws.readyState !== 1 /* WebSocket.OPEN */) return
		try {
			this.#ws.send(JSON.stringify(msg))
		} catch (e) {
			this.#logger.silly(`send failed: ${e}`)
		}
	}
}

function collectBoundVars(panel: Panel): Set<string> {
	const out = new Set<string>()
	for (const item of panel.items) {
		switch (item.kind) {
			case 'slider':
			case 'knob':
			case 'indicator':
			case 'meter':
			case 'input':
				out.add(item.bindVar)
				break
			case 'label':
				if (item.bindVar) out.add(item.bindVar)
				break
			case 'button':
				if (item.stateVar) out.add(item.stateVar)
				break
		}
	}
	return out
}

function coerceVariableValue(value: unknown): string | number | boolean | undefined {
	if (value === null || value === undefined) return undefined
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
	// Variables can only hold primitives — reject arrays/objects/etc rather than dumping
	// "[object Object]" into a custom variable.
	return undefined
}
