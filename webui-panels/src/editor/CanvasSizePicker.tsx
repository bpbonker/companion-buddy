import { useMemo } from 'react'
import type { Panel } from '@companion-app/shared/Model/PanelModel.js'

interface DevicePreset {
	id: string
	label: string
	width: number
	height: number
	cellPx: number
}

// Device sizes in landscape unless noted; values are CSS/logical pixels (1x DPR).
const DEVICE_PRESETS: DevicePreset[] = [
	{ id: 'ipad-mini', label: 'iPad mini (1024×768)', width: 1024, height: 768, cellPx: 32 },
	{ id: 'ipad-10', label: 'iPad 10.9" (1180×820)', width: 1180, height: 820, cellPx: 32 },
	{ id: 'ipad-air', label: 'iPad Air 11" (1180×820)', width: 1180, height: 820, cellPx: 32 },
	{ id: 'ipad-pro-11', label: 'iPad Pro 11" (1194×834)', width: 1194, height: 834, cellPx: 32 },
	{ id: 'ipad-pro-13', label: 'iPad Pro 13" (1366×1024)', width: 1366, height: 1024, cellPx: 32 },
	{ id: 'ipad-portrait', label: 'iPad portrait (768×1024)', width: 768, height: 1024, cellPx: 32 },
	{ id: 'ipad-pro-portrait', label: 'iPad Pro 13" portrait (1024×1366)', width: 1024, height: 1366, cellPx: 32 },
	{ id: 'hd-720', label: '720p (1280×720)', width: 1280, height: 720, cellPx: 32 },
	{ id: 'fhd', label: '1080p / FHD (1920×1080)', width: 1920, height: 1080, cellPx: 40 },
	{ id: 'qhd', label: '1440p / QHD (2560×1440)', width: 2560, height: 1440, cellPx: 40 },
	{ id: 'uhd-4k', label: '4K UHD (3840×2160)', width: 3840, height: 2160, cellPx: 48 },
]

export function CanvasSizePicker(props: { panel: Panel; onPanelChange: (patch: Partial<Panel>) => void }) {
	const { panel, onPanelChange } = props
	const grid = panel.grid
	const widthPx = grid.cols * grid.cellPx
	const heightPx = grid.rows * grid.cellPx

	const activePreset = useMemo(() => {
		return DEVICE_PRESETS.find((p) => p.width === widthPx && p.height === heightPx)?.id ?? 'custom'
	}, [widthPx, heightPx])

	function applyPreset(presetId: string) {
		if (presetId === 'custom') return
		const p = DEVICE_PRESETS.find((d) => d.id === presetId)
		if (!p) return
		onPanelChange({
			grid: {
				cols: Math.floor(p.width / p.cellPx),
				rows: Math.floor(p.height / p.cellPx),
				cellPx: p.cellPx,
				bg: grid.bg,
			},
		})
	}

	function applyPixels(nextWidth: number, nextHeight: number, nextCell: number) {
		const cell = Math.max(4, nextCell || grid.cellPx)
		onPanelChange({
			grid: {
				cols: Math.max(1, Math.round(nextWidth / cell)),
				rows: Math.max(1, Math.round(nextHeight / cell)),
				cellPx: cell,
				bg: grid.bg,
			},
		})
	}

	return (
		<>
			<div className="field">
				<label>Device preset</label>
				<select value={activePreset} onChange={(e) => applyPreset(e.target.value)} data-testid="canvas-preset">
					<option value="custom">— Custom —</option>
					{DEVICE_PRESETS.map((p) => (
						<option key={p.id} value={p.id}>
							{p.label}
						</option>
					))}
				</select>
			</div>
			<div className="field">
				<label>Canvas size (pixels)</label>
				<div className="row">
					<input
						type="number"
						value={widthPx}
						// min must be on the step grid (multiples of cellPx) — otherwise the
						// browser's step-down snaps to "min + step*N" which doesn't align with
						// widthPx, and Math.round in applyPixels rounds the value right back up.
						min={grid.cellPx}
						step={grid.cellPx}
						onChange={(e) => applyPixels(+e.target.value || widthPx, heightPx, grid.cellPx)}
						data-testid="canvas-width"
					/>
					<span style={{ display: 'flex', alignItems: 'center', padding: '0 4px', color: 'var(--cmp-card-muted)' }}>
						×
					</span>
					<input
						type="number"
						value={heightPx}
						min={grid.cellPx}
						step={grid.cellPx}
						onChange={(e) => applyPixels(widthPx, +e.target.value || heightPx, grid.cellPx)}
						data-testid="canvas-height"
					/>
				</div>
				<div style={{ fontSize: 11, color: 'var(--cmp-card-muted)', marginTop: 4 }}>
					{grid.cols} cols × {grid.rows} rows at {grid.cellPx}px
				</div>
			</div>
			<div className="field">
				<label>Cell size (px)</label>
				<input
					type="number"
					value={grid.cellPx}
					min={4}
					max={128}
					onChange={(e) => applyPixels(widthPx, heightPx, +e.target.value || grid.cellPx)}
					data-testid="canvas-cell"
				/>
				<div style={{ fontSize: 11, color: 'var(--cmp-card-muted)', marginTop: 4 }}>
					Snap grid + control sizing unit. Smaller cells = finer placement.
				</div>
			</div>
		</>
	)
}
