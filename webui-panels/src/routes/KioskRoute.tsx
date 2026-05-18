import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Panel, PanelItem } from '@companion-app/shared/Model/PanelModel.js'
import { ControlRenderer } from '../controls'
import { PanelClient, type PanelClientStatus } from '../runtime/PanelClient'
import { getTheme, themeCssVars } from '../themes/themes'

export function KioskRoute() {
	const { slug } = useParams<{ slug: string }>()
	const [search] = useSearchParams()
	const token = search.get('token') ?? ''
	const showStatus = search.get('debug') === '1' || search.get('debug') === 'true'

	const [panel, setPanel] = useState<Panel | null>(null)
	const [status, setStatus] = useState<PanelClientStatus>('connecting')
	const [statusInfo, setStatusInfo] = useState<string | undefined>()
	const [values, setValues] = useState<Record<string, unknown>>({})
	const clientRef = useRef<PanelClient | null>(null)

	useEffect(() => {
		if (!slug || !token) return
		const client = new PanelClient(slug, token, {
			onHello: (p, snap) => {
				setPanel(p)
				setValues(snap)
			},
			// Live push when the operator saves the panel — replace layout in place.
			// Snapshot is re-sent because new bound vars may not have been streamed yet.
			onPanel: (p, snap) => {
				setPanel(p)
				setValues(snap)
			},
			onVar: (name, value) => {
				setValues((vs) => ({ ...vs, [name]: value }))
			},
			onStatus: (s, info) => {
				setStatus(s)
				setStatusInfo(info)
			},
		})
		clientRef.current = client
		client.start()
		return () => {
			client.stop()
			clientRef.current = null
		}
	}, [slug, token])

	// kiosk hardening
	useEffect(() => {
		const block = (e: Event) => e.preventDefault()
		document.addEventListener('contextmenu', block)
		document.addEventListener('gesturestart', block)
		return () => {
			document.removeEventListener('contextmenu', block)
			document.removeEventListener('gesturestart', block)
		}
	}, [])

	useEffect(() => {
		if (status !== 'open') return
		const requestWake = async () => {
			try {
				const navAny = navigator as any
				if (navAny.wakeLock?.request) {
					await navAny.wakeLock.request('screen')
				}
			} catch {
				/* ignore */
			}
		}
		void requestWake()
	}, [status])

	// Paint html/body the panel's bg color while the kiosk is mounted. iPad PWAs sometimes
	// leave a sliver of the body bg visible under the home-indicator safe area; tinting the
	// underlying surfaces to match means even if my .kiosk div doesn't cover edge-to-edge,
	// the leftover strip is the right colour instead of the editor's grey chrome.
	useEffect(() => {
		const bg = panel?.bgColor ?? '#0b1220'
		const prevBody = document.body.style.background
		const prevHtml = document.documentElement.style.background
		document.body.style.background = bg
		document.documentElement.style.background = bg
		return () => {
			document.body.style.background = prevBody
			document.documentElement.style.background = prevHtml
		}
	}, [panel?.bgColor])

	// Per-panel PWA manifest + title. When the user does "Add to Home Screen" on an iPad,
	// iOS reads apple-mobile-web-app-title (set globally) and the apple-touch-icon. On Android,
	// the Web App Manifest is what drives the install entry. We generate it from the panel here
	// so the home-screen icon is labelled with the panel name and start_url restores the same
	// kiosk URL (token included).
	const themeColor = panel?.bgColor ?? panel?.accentColor ?? '#0b1220'
	useEffect(() => {
		if (!panel) return
		document.title = `${panel.name} — Buddy`

		// Icon paths are absolute and depend on whether we're served from the panels mount
		// (production: /panels-ui/) or the Vite dev server / root.
		const iconBase = window.location.pathname.startsWith('/panels-ui/') ? '/panels-ui' : ''
		const manifest = {
			name: `${panel.name} — Buddy`,
			short_name: panel.name.slice(0, 12),
			start_url: window.location.pathname + window.location.search,
			scope: window.location.pathname.startsWith('/panels-ui/') ? '/panels-ui/' : '/',
			display: 'fullscreen',
			display_override: ['fullscreen', 'standalone'],
			orientation: 'any',
			background_color: panel.bgColor ?? '#0b1220',
			theme_color: themeColor,
			icons: [
				{ src: `${iconBase}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
				{ src: `${iconBase}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
			],
		}
		const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
		const url = URL.createObjectURL(blob)

		let link = document.querySelector('link[rel="manifest"]')
		if (!link) {
			link = document.createElement('link')
			link.rel = 'manifest'
			document.head.appendChild(link)
		}
		const prev = link.href
		link.href = url

		// Keep the meta theme-color in sync so iOS / Android status bars match the panel's bg.
		const themeMeta = document.querySelector('meta[name="theme-color"]')
		const prevTheme = themeMeta?.content
		if (themeMeta) themeMeta.content = themeColor

		return () => {
			URL.revokeObjectURL(url)
			if (link && prev) link.href = prev
			if (themeMeta && prevTheme !== undefined) themeMeta.content = prevTheme
		}
	}, [panel, themeColor])

	if (!token) {
		return <div className="kiosk kiosk-error">Missing ?token= parameter</div>
	}

	if (status === 'denied') {
		return (
			<div className="kiosk kiosk-error" data-testid="kiosk-denied">
				<div>Access denied</div>
				<div style={{ fontSize: 12, color: '#94a3b8' }}>{statusInfo ?? 'token rejected or revoked'}</div>
			</div>
		)
	}

	if (!panel) {
		return (
			<div className="kiosk kiosk-error" data-testid="kiosk-connecting">
				<div>Connecting…</div>
				<div style={{ fontSize: 12, color: '#94a3b8' }}>
					{status}
					{statusInfo ? ` — ${statusInfo}` : ''}
				</div>
			</div>
		)
	}

	return (
		<KioskCanvas
			panel={panel}
			values={values}
			status={status}
			statusInfo={statusInfo}
			showStatus={showStatus}
			onWriteVar={(itemId, varName, value) => clientRef.current?.writeVar(itemId, varName, value)}
			onPress={(itemId, pressed) => clientRef.current?.press(itemId, pressed)}
		/>
	)
}

function KioskCanvas(props: {
	panel: Panel
	values: Record<string, unknown>
	status: PanelClientStatus
	statusInfo: string | undefined
	showStatus: boolean
	onWriteVar: (itemId: string, varName: string, value: unknown) => void
	onPress: (itemId: string, pressed: boolean) => void
}) {
	const { panel, values, status, statusInfo, showStatus, onWriteVar, onPress } = props

	const containerRef = useRef<HTMLDivElement>(null)
	// Non-uniform stretch: scale X and Y independently so the panel fills the whole tablet
	// screen, even when the kiosk's aspect ratio doesn't match the panel grid's.
	const [scale, setScale] = useState({ x: 1, y: 1 })

	const cellPx = panel.grid.cellPx
	const designW = panel.grid.cols * cellPx
	const designH = panel.grid.rows * cellPx

	useEffect(() => {
		function recompute() {
			const el = containerRef.current
			if (!el) return
			const sx = el.clientWidth / designW
			const sy = el.clientHeight / designH
			setScale({ x: Math.max(0.1, sx), y: Math.max(0.1, sy) })
		}
		recompute()
		const ro = new ResizeObserver(recompute)
		if (containerRef.current) ro.observe(containerRef.current)
		window.addEventListener('resize', recompute)
		return () => {
			ro.disconnect()
			window.removeEventListener('resize', recompute)
		}
	}, [designW, designH])

	const valueForItem = useMemo(() => {
		return (item: PanelItem) => {
			const bind = bindVarOf(item)
			if (!bind) return undefined
			return values[bind]
		}
	}, [values])

	const themeStyle = themeCssVars(getTheme(panel.theme), {
		accentColor: panel.accentColor,
		bgColor: panel.bgColor,
	}) as React.CSSProperties

	return (
		<div className="kiosk" ref={containerRef} data-testid="kiosk-canvas" data-status={status} style={themeStyle}>
			<div
				className={`kiosk-stage ${panel.frame ? 'framed' : ''}`}
				style={{
					width: designW,
					height: designH,
					transform: `scale(${scale.x}, ${scale.y})`,
					transformOrigin: 'top left',
					background: panel.bgColor ?? panel.grid.bg ?? 'var(--bp-canvas-bg)',
					left: 0,
					top: 0,
					marginLeft: 0,
					marginTop: 0,
				}}
			>
				{panel.items.map((it) => (
					<div
						key={it.id}
						style={{
							position: 'absolute',
							left: it.x * cellPx,
							top: it.y * cellPx,
							width: it.w * cellPx,
							height: it.h * cellPx,
						}}
						data-item-id={it.id}
						data-item-kind={it.kind}
					>
						<ControlRenderer
							item={it}
							mode="runtime"
							value={valueForItem(it)}
							onWriteVar={(name, val) => onWriteVar(it.id, name, val)}
							onPress={(pressed) => onPress(it.id, pressed)}
							panelPin={panel.pin}
						/>
					</div>
				))}
			</div>
			{showStatus && (
				<div className="kiosk-status" data-testid="kiosk-status">
					{status}
					{statusInfo ? ` · ${statusInfo}` : ''}
				</div>
			)}
		</div>
	)
}

function bindVarOf(item: PanelItem): string | undefined {
	switch (item.kind) {
		case 'slider':
		case 'knob':
		case 'indicator':
		case 'meter':
		case 'input':
			return item.bindVar
		case 'label':
			return item.bindVar
		case 'button':
			return item.stateVar
		default:
			return undefined
	}
}
