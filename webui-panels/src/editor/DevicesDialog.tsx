import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import type { Panel, PanelDeviceSummary } from '@companion-app/shared/Model/PanelModel.js'
import { useTRPC } from '../trpc'

export function DevicesDialog(props: { panel: Panel; onClose: () => void }) {
	const { panel, onClose } = props
	const trpc = useTRPC()
	const queryClient = useQueryClient()

	const listQuery = useQuery(trpc.panels.tokens.list.queryOptions({ panelId: panel.id }))
	const devices: PanelDeviceSummary[] = listQuery.data ?? []
	const hostQuery = useQuery(trpc.panels.settings.getKioskHost.queryOptions())
	const kioskHost = hostQuery.data?.host ?? ''

	const [newName, setNewName] = useState('')
	const [showQrFor, setShowQrFor] = useState<string | null>(null)

	const mintMutation = useMutation(
		trpc.panels.tokens.mint.mutationOptions({
			onSuccess: (created: any) => {
				queryClient.invalidateQueries({ queryKey: trpc.panels.tokens.list.queryKey({ panelId: panel.id }) })
				queryClient.invalidateQueries({ queryKey: trpc.panels.list.queryKey() })
				setNewName('')
				if (created?.token) setShowQrFor(created.token)
			},
		})
	)

	const revokeMutation = useMutation(
		trpc.panels.tokens.revoke.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.panels.tokens.list.queryKey({ panelId: panel.id }) })
				queryClient.invalidateQueries({ queryKey: trpc.panels.list.queryKey() })
			},
		})
	)

	function kioskUrl(token: string): string {
		// Production: tablets need to reach the Companion server over LAN, not localhost.
		// If the operator set an explicit kioskHost, that's the authority — fall back to the
		// browser's origin only when nothing is configured.
		const base = normalizeHost(kioskHost) || window.location.origin
		return `${base}/panels-ui/panel/${panel.slug}?token=${token}`
	}

	function devKioskUrl(token: string): string {
		// In dev, the kiosk is served from this same Vite app (no /panels-ui prefix). The kiosk-host
		// setting points at the production backend, so we don't apply it here.
		return `${window.location.origin}/panel/${panel.slug}?token=${token}`
	}

	const activeDevice = showQrFor ? devices.find((d) => d.token === showQrFor) : null

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div className="modal" style={{ minWidth: 480, maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
				<h2>Devices for "{panel.name}"</h2>

				<div className="field">
					<label>Add a device</label>
					<div className="row">
						<input
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="Lobby tablet"
							data-testid="device-name-input"
						/>
						<button
							className="primary"
							disabled={!newName.trim() || mintMutation.isPending}
							onClick={() => mintMutation.mutate({ panelId: panel.id, label: newName.trim() })}
							data-testid="device-add"
						>
							{mintMutation.isPending ? 'Adding…' : 'Add + show QR'}
						</button>
					</div>
				</div>

				{showQrFor && activeDevice && (
					<QrSection
						deviceLabel={activeDevice.label}
						kioskUrl={kioskUrl(showQrFor)}
						devKioskUrl={devKioskUrl(showQrFor)}
						onClose={() => setShowQrFor(null)}
					/>
				)}

				<h3 style={{ marginTop: 16 }}>Active devices ({devices.length})</h3>
				{listQuery.isLoading && <p>Loading…</p>}
				{!listQuery.isLoading && devices.length === 0 && (
					<p style={{ color: '#64748b', fontSize: 12 }}>
						None yet. Add a device above to mint its token and show its onboarding QR.
					</p>
				)}
				{devices.map((d) => (
					<div key={d.token} className="token-row">
						<div style={{ flex: 1, minWidth: 0 }}>
							<div style={{ fontWeight: 500 }}>{d.label || '(unnamed)'}</div>
							<div style={{ fontSize: 11, color: '#64748b' }}>
								{d.lastSeenAt ? `last seen ${formatRelative(d.lastSeenAt)}` : 'never connected'}
								{d.lastUserAgent ? ` — ${shortUA(d.lastUserAgent)}` : ''}
							</div>
						</div>
						<button onClick={() => setShowQrFor(d.token)}>QR</button>
						<button
							className="danger"
							onClick={() => {
								if (confirm(`Revoke device "${d.label}"? Its tablet will disconnect.`)) {
									revokeMutation.mutate({ panelId: panel.id, token: d.token })
								}
							}}
							data-testid={`device-revoke-${d.label}`}
						>
							Revoke
						</button>
					</div>
				))}

				<div className="actions">
					<button onClick={onClose}>Close</button>
				</div>
			</div>
		</div>
	)
}

function QrSection(props: { deviceLabel: string; kioskUrl: string; devKioskUrl: string; onClose: () => void }) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const [mode, setMode] = useState<'prod' | 'dev'>('dev')

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const url = mode === 'prod' ? props.kioskUrl : props.devKioskUrl
		QRCode.toCanvas(canvas, url, { width: 240, margin: 1, color: { dark: '#0b1220', light: '#e2e8f0' } }, (err) => {
			if (err) console.error(err)
		})
	}, [mode, props.kioskUrl, props.devKioskUrl])

	const activeUrl = mode === 'prod' ? props.kioskUrl : props.devKioskUrl

	return (
		<div style={{ background: '#020617', border: '1px solid #1e293b', padding: 12, borderRadius: 6, marginTop: 10 }}>
			<div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
				<canvas
					ref={canvasRef}
					width={240}
					height={240}
					style={{ borderRadius: 4, background: '#e2e8f0' }}
					data-testid="device-qr"
				/>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ fontWeight: 500, marginBottom: 6 }}>Onboard "{props.deviceLabel}"</div>
					<div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
						Scan this on the tablet's camera, then set the resulting URL as the kiosk browser's home page.
					</div>
					<div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
						<button onClick={() => setMode('dev')} className={mode === 'dev' ? 'primary' : ''}>
							dev URL
						</button>
						<button onClick={() => setMode('prod')} className={mode === 'prod' ? 'primary' : ''}>
							prod URL
						</button>
					</div>
					<div className="token-row">
						<code style={{ fontSize: 10 }}>{activeUrl}</code>
						<button onClick={async () => navigator.clipboard.writeText(activeUrl)}>Copy</button>
					</div>
					<button style={{ marginTop: 8 }} onClick={props.onClose}>
						Hide QR
					</button>
				</div>
			</div>
		</div>
	)
}

function normalizeHost(h: string): string {
	const v = h.trim().replace(/\/+$/, '')
	if (!v) return ''
	if (/^https?:\/\//i.test(v)) return v
	return `http://${v}`
}

function formatRelative(t: number): string {
	const s = Math.floor((Date.now() - t) / 1000)
	if (s < 60) return `${s}s ago`
	if (s < 3600) return `${Math.floor(s / 60)}m ago`
	if (s < 86400) return `${Math.floor(s / 3600)}h ago`
	return `${Math.floor(s / 86400)}d ago`
}

function shortUA(ua: string): string {
	const m = /(Chrome|Firefox|Safari|Edge|iPad|iPhone|Android)[^);]*?[\d.]*/.exec(ua)
	if (m) return m[0]
	return ua.slice(0, 24)
}
