import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Panel, PanelItem, PanelItemKind } from '@companion-app/shared/Model/PanelModel.js'
import { ControlRenderer } from '../controls'
import { DevicesDialog } from '../editor/DevicesDialog'
import { Inspector } from '../editor/Inspector'
import { getTheme, themeCssVars } from '../themes/themes'
import { useTRPC } from '../trpc'

const KINDS: {
	kind: PanelItemKind
	label: string
	icon: string
	defaultSize: [number, number]
	section: 'control' | 'layout'
}[] = [
	{ kind: 'button', label: 'Button', icon: '◉', defaultSize: [4, 3], section: 'control' },
	{ kind: 'slider', label: 'Slider', icon: '⊟', defaultSize: [3, 10], section: 'control' },
	{ kind: 'knob', label: 'Knob', icon: '◎', defaultSize: [4, 4], section: 'control' },
	{ kind: 'indicator', label: 'Indicator', icon: '●', defaultSize: [3, 3], section: 'control' },
	{ kind: 'meter', label: 'Meter', icon: '▤', defaultSize: [3, 8], section: 'control' },
	{ kind: 'label', label: 'Label', icon: 'T', defaultSize: [6, 2], section: 'control' },
	{ kind: 'image', label: 'Image', icon: '▣', defaultSize: [6, 6], section: 'control' },
	{ kind: 'input', label: 'Input', icon: '⌨', defaultSize: [6, 3], section: 'control' },
	{ kind: 'group', label: 'Group / Box', icon: '⬚', defaultSize: [14, 10], section: 'layout' },
]

export function EditorRoute() {
	const { panelId } = useParams<{ panelId: string }>()
	const trpc = useTRPC()
	const queryClient = useQueryClient()

	const panelQuery = useQuery(trpc.panels.get.queryOptions({ id: panelId! }))
	const [panel, setPanel] = useState<Panel | null>(null)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [showDevices, setShowDevices] = useState(false)
	const [dirty, setDirty] = useState(false)

	useEffect(() => {
		if (panelQuery.data) {
			setPanel(panelQuery.data as Panel)
			setDirty(false)
		}
	}, [panelQuery.data])

	const saveMutation = useMutation(
		trpc.panels.save.mutationOptions({
			onSuccess: () => {
				setDirty(false)
				queryClient.invalidateQueries({ queryKey: trpc.panels.list.queryKey() })
				queryClient.invalidateQueries({ queryKey: trpc.panels.get.queryKey({ id: panelId! }) })
			},
		})
	)

	const updatePanel = useCallback((patch: Partial<Panel>) => {
		setPanel((p) => (p ? { ...p, ...patch, updatedAt: Date.now() } : p))
		setDirty(true)
	}, [])

	const updateItem = useCallback((id: string, patch: Partial<PanelItem>) => {
		setPanel((p) => {
			if (!p) return p
			return {
				...p,
				items: p.items.map((it) => (it.id === id ? ({ ...it, ...patch } as PanelItem) : it)),
				updatedAt: Date.now(),
			}
		})
		setDirty(true)
	}, [])

	const deleteItem = useCallback((id: string) => {
		setPanel((p) => (p ? { ...p, items: p.items.filter((it) => it.id !== id), updatedAt: Date.now() } : p))
		setSelectedId(null)
		setDirty(true)
	}, [])

	function addItem(kind: PanelItemKind, x: number, y: number) {
		if (!panel) return
		const def = KINDS.find((k) => k.kind === kind)!
		const id = nanoid(8)
		const [w, h] = def.defaultSize
		// When the caller passed the default (1,1) "click-to-place" position, drop items
		// into the first column that's free, then wrap rows. Drag-drop callers pass a
		// specific cell and get exactly that.
		let finalX = x
		let finalY = y
		if (x === 1 && y === 1 && panel.items.length > 0) {
			const occupied = panel.items.map((it) => ({ x: it.x, y: it.y, w: it.w, h: it.h }))
			outer: for (let row = 1; row < panel.grid.rows; row += 1) {
				for (let col = 1; col + w < panel.grid.cols; col += 1) {
					const hit = occupied.some((o) => col < o.x + o.w && col + w > o.x && row < o.y + o.h && row + h > o.y)
					if (!hit) {
						finalX = col
						finalY = row
						break outer
					}
				}
			}
		}
		const base = {
			id,
			x: finalX,
			y: finalY,
			w,
			h,
			style: {},
		}
		let item: PanelItem
		switch (kind) {
			case 'button':
				item = { kind: 'button', mode: 'press', ...base }
				break
			case 'slider':
				item = {
					kind: 'slider',
					orientation: 'vertical',
					min: 0,
					max: 100,
					step: 1,
					bindVar: 'custom:slider1',
					sendRateMs: 50,
					...base,
				}
				break
			case 'knob':
				item = { kind: 'knob', min: 0, max: 100, step: 1, bindVar: 'custom:knob1', sendRateMs: 50, ...base }
				break
			case 'indicator':
				item = { kind: 'indicator', bindVar: 'custom:status', colorOn: '#22c55e', colorOff: '#3f3f46', ...base }
				break
			case 'meter':
				item = {
					kind: 'meter',
					bindVar: 'custom:meter1',
					min: 0,
					max: 100,
					orientation: 'vertical',
					colorFill: '#22c55e',
					...base,
				}
				break
			case 'label':
				item = { kind: 'label', text: 'Label', ...base }
				break
			case 'image':
				item = { kind: 'image', src: '', fit: 'contain', ...base }
				break
			case 'input':
				item = { kind: 'input', inputType: 'number', placeholder: '', bindVar: 'custom:value', ...base }
				break
			case 'group':
				item = { kind: 'group', title: '', variant: 'solid', ...base }
				break
		}
		// Groups go to the back so other items appear over them
		const next = kind === 'group' ? [item, ...panel.items] : [...panel.items, item]
		updatePanel({ items: next })
		setSelectedId(id)
	}

	const selected = useMemo(() => panel?.items.find((i) => i.id === selectedId) ?? null, [panel, selectedId])

	const cellPx = panel?.grid.cellPx ?? 24
	const canvasW = (panel?.grid.cols ?? 40) * cellPx
	const canvasH = (panel?.grid.rows ?? 24) * cellPx

	// Zoom: 'fit' auto-fits canvas to available host space; numbers are explicit zoom factors.
	const [zoomMode, setZoomMode] = useState<'fit' | number>('fit')
	const hostRef = useRef<HTMLDivElement>(null)
	const [hostSize, setHostSize] = useState({ w: 0, h: 0 })

	useEffect(() => {
		const el = hostRef.current
		if (!el) return
		const update = () => setHostSize({ w: el.clientWidth, h: el.clientHeight })
		update()
		const ro = new ResizeObserver(update)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])

	const zoom = useMemo(() => {
		if (zoomMode === 'fit') {
			if (hostSize.w === 0 || hostSize.h === 0) return 1
			const padding = 56
			const fitW = (hostSize.w - padding) / canvasW
			const fitH = (hostSize.h - padding) / canvasH
			return Math.max(0.05, Math.min(2, Math.min(fitW, fitH)))
		}
		return zoomMode
	}, [zoomMode, hostSize, canvasW, canvasH])

	if (panelQuery.isLoading || !panel)
		return (
			<div className="app-shell">
				<div className="toolbar">
					<div className="title">Loading…</div>
				</div>
			</div>
		)
	if (panelQuery.error)
		return (
			<div className="app-shell">
				<div className="toolbar">
					<div className="title" style={{ color: '#fca5a5' }}>
						Error: {String(panelQuery.error)}
					</div>
				</div>
			</div>
		)

	return (
		<div className="app-shell">
			<div className="toolbar">
				<div className="brand">
					Companion<span className="accent">/</span>Panels
				</div>
				<Link to="/editor">
					<button className="ghost">← All panels</button>
				</Link>
				<div className="title">
					{panel.name}
					{dirty && <span className="dirty">●</span>}
				</div>
				<div className="zoom-control">
					<button
						className="ghost"
						onClick={() => setZoomMode((z) => Math.max(0.1, (typeof z === 'number' ? z : zoom) - 0.1))}
						title="Zoom out"
					>
						−
					</button>
					<select
						value={zoomMode === 'fit' ? 'fit' : zoomMode.toString()}
						onChange={(e) => setZoomMode(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}
						title="Zoom level"
					>
						<option value="fit">Fit ({(zoom * 100).toFixed(0)}%)</option>
						<option value="0.25">25%</option>
						<option value="0.5">50%</option>
						<option value="0.75">75%</option>
						<option value="1">100%</option>
						<option value="1.5">150%</option>
						<option value="2">200%</option>
					</select>
					<button
						className="ghost"
						onClick={() => setZoomMode((z) => Math.min(2, (typeof z === 'number' ? z : zoom) + 0.1))}
						title="Zoom in"
					>
						+
					</button>
				</div>
				<button onClick={() => setShowDevices(true)}>Devices</button>
				<button
					className="primary"
					disabled={!dirty || saveMutation.isPending}
					onClick={() =>
						saveMutation.mutate({
							id: panel.id,
							name: panel.name,
							slug: panel.slug,
							grid: panel.grid,
							theme: panel.theme,
							accentColor: panel.accentColor ?? null,
							bgColor: panel.bgColor ?? null,
							frame: !!panel.frame,
							pin: panel.pin ?? null,
							items: panel.items,
						} as any)
					}
				>
					{saveMutation.isPending ? 'Saving…' : 'Save'}
				</button>
			</div>

			<div
				className="editor-layout"
				style={themeCssVars(getTheme(panel.theme), {
					accentColor: panel.accentColor,
					bgColor: panel.bgColor,
				})}
			>
				<div className="palette">
					<h3>Controls</h3>
					{KINDS.filter((k) => k.section === 'control').map((k) => (
						<button
							key={k.kind}
							className="palette-item"
							draggable
							onDragStart={(e) => {
								e.dataTransfer.setData('text/x-panel-kind', k.kind)
								e.dataTransfer.effectAllowed = 'copy'
							}}
							onClick={() => addItem(k.kind, 1, 1)}
							data-testid={`palette-${k.kind}`}
						>
							<span className="icon">{k.icon}</span>
							{k.label}
						</button>
					))}
					<h3 style={{ marginTop: 20 }}>Layout</h3>
					{KINDS.filter((k) => k.section === 'layout').map((k) => (
						<button
							key={k.kind}
							className="palette-item"
							draggable
							onDragStart={(e) => {
								e.dataTransfer.setData('text/x-panel-kind', k.kind)
								e.dataTransfer.effectAllowed = 'copy'
							}}
							onClick={() => addItem(k.kind, 1, 1)}
							data-testid={`palette-${k.kind}`}
						>
							<span className="icon">{k.icon}</span>
							{k.label}
						</button>
					))}
				</div>

				<div
					className="canvas-host"
					ref={hostRef}
					onDragOver={(e) => {
						e.preventDefault()
						e.dataTransfer.dropEffect = 'copy'
					}}
					onDrop={(e) => {
						const kind = e.dataTransfer.getData('text/x-panel-kind') as PanelItemKind
						if (!kind) return
						e.preventDefault()
						const host = e.currentTarget.querySelector('.canvas') as HTMLElement
						const rect = host.getBoundingClientRect()
						// rect is post-transform; divide by current zoom to get unscaled canvas coords.
						const x = Math.max(0, Math.round((e.clientX - rect.left) / cellPx / zoom))
						const y = Math.max(0, Math.round((e.clientY - rect.top) / cellPx / zoom))
						addItem(kind, x, y)
					}}
				>
					<div className="canvas-scale-wrap" style={{ width: canvasW * zoom, height: canvasH * zoom }}>
						<div
							className={`canvas ${panel.frame ? 'framed' : ''}`}
							style={{
								width: canvasW,
								height: canvasH,
								['--cell' as any]: `${cellPx}px`,
								background: panel.bgColor ?? panel.grid.bg ?? 'var(--bp-canvas-bg, #0b1220)',
								transform: `scale(${zoom})`,
								transformOrigin: 'top left',
							}}
							onPointerDown={(e) => {
								if (e.target === e.currentTarget) setSelectedId(null)
							}}
						>
							{panel.items.map((it) => (
								<CanvasItem
									key={it.id}
									item={it}
									cellPx={cellPx}
									zoom={zoom}
									selected={it.id === selectedId}
									onSelect={() => setSelectedId(it.id)}
									onChange={(patch) => updateItem(it.id, patch)}
								/>
							))}
						</div>
					</div>
				</div>

				<Inspector
					panel={panel}
					selected={selected}
					onChange={(p) => selected && updateItem(selected.id, p)}
					onPanelChange={(p) => updatePanel(p)}
					onDelete={() => selected && deleteItem(selected.id)}
				/>
			</div>

			{showDevices && <DevicesDialog panel={panel} onClose={() => setShowDevices(false)} />}
		</div>
	)
}

function CanvasItem(props: {
	item: PanelItem
	cellPx: number
	zoom: number
	selected: boolean
	onSelect: () => void
	onChange: (patch: Partial<PanelItem>) => void
}) {
	const { item, cellPx, zoom, selected, onSelect, onChange } = props
	const [drag, setDrag] = useState<null | {
		type: 'move' | 'resize'
		sx: number
		sy: number
		ox: number
		oy: number
		ow: number
		oh: number
	}>(null)

	function onMoveStart(e: React.PointerEvent) {
		if (e.button !== 0) return
		e.stopPropagation()
		onSelect()
		;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
		setDrag({ type: 'move', sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y, ow: item.w, oh: item.h })
	}

	function onResizeStart(e: React.PointerEvent) {
		if (e.button !== 0) return
		e.stopPropagation()
		;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
		setDrag({ type: 'resize', sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y, ow: item.w, oh: item.h })
	}

	function onMove(e: React.PointerEvent) {
		if (!drag) return
		// Deltas are in screen pixels; un-scale by zoom and snap to whole cells.
		const dxCells = Math.round((e.clientX - drag.sx) / cellPx / zoom)
		const dyCells = Math.round((e.clientY - drag.sy) / cellPx / zoom)
		if (drag.type === 'move') {
			const nx = Math.max(0, drag.ox + dxCells)
			const ny = Math.max(0, drag.oy + dyCells)
			if (nx !== item.x || ny !== item.y) onChange({ x: nx, y: ny })
		} else {
			const nw = Math.max(1, drag.ow + dxCells)
			const nh = Math.max(1, drag.oh + dyCells)
			if (nw !== item.w || nh !== item.h) onChange({ w: nw, h: nh })
		}
	}

	function onMoveEnd() {
		setDrag(null)
	}

	return (
		<div
			className={`item ${selected ? 'selected' : ''}`}
			style={{ left: item.x * cellPx, top: item.y * cellPx, width: item.w * cellPx, height: item.h * cellPx }}
			data-item-id={item.id}
			data-item-kind={item.kind}
			onPointerDown={onMoveStart}
			onPointerMove={onMove}
			onPointerUp={onMoveEnd}
			onPointerCancel={onMoveEnd}
		>
			<ControlRenderer item={item} mode="design" value={undefined} />
			{selected && (
				<div className="resize-handle" onPointerDown={onResizeStart} onPointerMove={onMove} onPointerUp={onMoveEnd} />
			)}
		</div>
	)
}
