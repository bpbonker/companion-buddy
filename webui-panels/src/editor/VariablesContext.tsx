import { useSubscription } from '@trpc/tanstack-react-query'
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type PropsWithChildren } from 'react'
import { useTRPC } from '../trpc'

export interface VariableEntry {
	fqn: string
	label: string
	name: string
	description?: string
	isCustom: boolean
}

interface Store {
	custom: Map<string, { description?: string }>
	conn: Map<string, Map<string, { description?: string }>>
	listeners: Set<() => void>
}

const store: Store = {
	custom: new Map(),
	conn: new Map(),
	listeners: new Set(),
}

function emit() {
	for (const l of store.listeners) l()
}

function subscribe(cb: () => void) {
	store.listeners.add(cb)
	return () => store.listeners.delete(cb)
}

function getSnapshot(): VariableEntry[] {
	const out: VariableEntry[] = []
	for (const [name, info] of store.custom) {
		out.push({ fqn: `custom:${name}`, label: 'custom', name, description: info.description, isCustom: true })
	}
	for (const [label, vars] of store.conn) {
		for (const [name, info] of vars) {
			out.push({ fqn: `${label}:${name}`, label, name, description: info.description, isCustom: false })
		}
	}
	out.sort((a, b) => (a.isCustom === b.isCustom ? a.fqn.localeCompare(b.fqn) : a.isCustom ? -1 : 1))
	return out
}

// Cache the snapshot reference to keep useSyncExternalStore happy.
let snapshotCache: VariableEntry[] = []
let snapshotDirty = true
function cachedSnapshot(): VariableEntry[] {
	if (snapshotDirty) {
		snapshotCache = getSnapshot()
		snapshotDirty = false
	}
	return snapshotCache
}
const origEmit = emit
function emitAndInvalidate() {
	snapshotDirty = true
	origEmit()
}

const VariablesCtx = createContext<{ entries: VariableEntry[] } | null>(null)

export function VariablesProvider({ children }: PropsWithChildren) {
	const trpc = useTRPC()

	useSubscription(
		(trpc as any).customVariables.watch.subscriptionOptions(undefined, {
			onData: (updates: any[]) => {
				for (const u of updates) {
					if (u.type === 'init') {
						store.custom.clear()
						for (const [name, info] of Object.entries(u.info || {})) {
							store.custom.set(name, { description: (info as any)?.description })
						}
					} else if (u.type === 'update') {
						store.custom.set(u.itemId, { description: u.info?.description })
					} else if (u.type === 'remove') {
						store.custom.delete(u.itemId)
					}
				}
				emitAndInvalidate()
			},
			onError: (e: unknown) => console.warn('customVariables watch error', e),
		})
	)

	useSubscription(
		(trpc as any).variables.definitions.watch.subscriptionOptions(undefined, {
			onData: (change: any) => {
				if (change.type === 'init') {
					store.conn.clear()
					for (const [label, defs] of Object.entries(change.variables || {})) {
						const m = new Map<string, { description?: string }>()
						for (const [name, info] of Object.entries((defs as any) || {})) {
							m.set(name, { description: (info as any)?.description })
						}
						store.conn.set(label, m)
					}
				} else if (change.type === 'set') {
					const m = new Map<string, { description?: string }>()
					for (const [name, info] of Object.entries(change.variables || {})) {
						m.set(name, { description: (info as any)?.description })
					}
					store.conn.set(change.label, m)
				} else if (change.type === 'patch') {
					const m = store.conn.get(change.label) ?? new Map()
					for (const k of Object.keys(change.added ?? {})) {
						m.set(k, { description: change.added[k]?.description })
					}
					for (const k of Object.keys(change.changed ?? {})) {
						m.set(k, { description: change.changed[k]?.description })
					}
					for (const k of change.removed ?? []) m.delete(k)
					store.conn.set(change.label, m)
				} else if (change.type === 'remove') {
					store.conn.delete(change.label)
				}
				emitAndInvalidate()
			},
			onError: (e: unknown) => console.warn('variables.definitions watch error', e),
		})
	)

	const entries = useSyncExternalStore(subscribe, cachedSnapshot, cachedSnapshot)
	const value = useMemo(() => ({ entries }), [entries])

	return <VariablesCtx.Provider value={value}>{children}</VariablesCtx.Provider>
}

export function useKnownVariables(): VariableEntry[] {
	const ctx = useContext(VariablesCtx)
	if (!ctx) return [] // VariablesProvider not mounted (e.g. on the kiosk route)
	return ctx.entries
}

export function useFilteredVariables(query: string, limit = 60): VariableEntry[] {
	const all = useKnownVariables()
	return useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return all.slice(0, limit)
		return all
			.filter((v) => v.fqn.toLowerCase().includes(q) || v.description?.toLowerCase().includes(q))
			.slice(0, limit)
	}, [all, query, limit])
}

// Force callers to read the unused symbol so tree-shaking doesn't drop it accidentally
export const _stableSubscribe = useCallback
