import { useEffect, useRef, useState } from 'react'
import type { PanelKnobItem } from '@companion-app/shared/Model/PanelModel.js'
import { asNumber, type ControlRenderProps } from './index'

const ANGLE_MIN = -135
const ANGLE_MAX = 135

export function KnobControl(props: ControlRenderProps & { item: PanelKnobItem }) {
	const { item, mode, value, onWriteVar } = props
	const externalValue = asNumber(value, item.min)
	const [dragValue, setDragValue] = useState<number | null>(null)
	const current = dragValue ?? externalValue
	const pct = clamp01((current - item.min) / (item.max - item.min || 1))
	const angle = ANGLE_MIN + pct * (ANGLE_MAX - ANGLE_MIN)

	const interactive = mode === 'runtime'
	const lastSendRef = useRef(0)
	const trailingRef = useRef<number | null>(null)
	const ref = useRef<HTMLDivElement>(null)
	// Slider-style drag: lock the start point + start value on press, then translate
	// vertical-only motion into a value delta. Horizontal motion is ignored so the user
	// can't accidentally flip across the angular gap from 0 → 100 by dragging sideways.
	const dragStartRef = useRef<{ y: number; v: number } | null>(null)

	function send(v: number) {
		const snapped = snapToStep(v, item.min, item.max, item.step)
		const now = performance.now()
		if (now - lastSendRef.current >= item.sendRateMs) {
			lastSendRef.current = now
			trailingRef.current = null
			onWriteVar?.(item.bindVar, snapped)
		} else {
			trailingRef.current = snapped
		}
	}

	useEffect(() => {
		if (!interactive) return
		const id = setInterval(() => {
			if (trailingRef.current !== null) {
				lastSendRef.current = performance.now()
				const v = trailingRef.current
				trailingRef.current = null
				onWriteVar?.(item.bindVar, v)
			}
		}, item.sendRateMs)
		return () => clearInterval(id)
	}, [interactive, item.sendRateMs, item.bindVar, onWriteVar])

	// Vertical drag distance (in screen pixels) that covers the full min→max range.
	// 200px feels about right on tablets — short enough to be quick, long enough for fine control.
	const PIXELS_PER_FULL_RANGE = 200

	function handleDrag(clientY: number) {
		const start = dragStartRef.current
		if (!start) return
		const range = item.max - item.min || 1
		// Up = increase, down = decrease (screen Y increases downward).
		const dy = start.y - clientY
		const v = start.v + (dy / PIXELS_PER_FULL_RANGE) * range
		const clamped = Math.max(item.min, Math.min(item.max, v))
		setDragValue(clamped)
		send(clamped)
	}

	const trackR = 78
	const strokeW = 10
	const arcLen = Math.PI * trackR * 2 * (270 / 360)
	const fillLen = arcLen * pct

	return (
		<div
			ref={ref}
			className="control control-knob"
			style={{
				width: '100%',
				height: '100%',
				background: item.style.bg ?? 'transparent',
				border: 'none',
				position: 'relative',
				cursor: interactive ? 'pointer' : 'default',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				color: item.style.fg ?? 'var(--bp-label-fg)',
				fontSize: item.style.fontSize ?? 14,
				userSelect: 'none',
			}}
			onPointerDown={(e) => {
				if (!interactive) return
				e.currentTarget.setPointerCapture(e.pointerId)
				dragStartRef.current = { y: e.clientY, v: current }
				setDragValue(current)
			}}
			onPointerMove={(e) => {
				if (!interactive) return
				if (e.buttons === 0) return
				handleDrag(e.clientY)
			}}
			onPointerUp={() => {
				dragStartRef.current = null
				setDragValue(null)
			}}
			onPointerCancel={() => {
				dragStartRef.current = null
				setDragValue(null)
			}}
			onContextMenu={(e) => e.preventDefault()}
		>
			<svg viewBox="-100 -100 200 200" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
				{/* Background arc track */}
				<circle
					cx="0"
					cy="0"
					r={trackR}
					fill="none"
					stroke="var(--bp-track-bg)"
					strokeWidth={strokeW}
					strokeLinecap="round"
					strokeDasharray={`${arcLen} 9999`}
					transform="rotate(135)"
				/>
				{/* Filled arc — solid accent */}
				<circle
					cx="0"
					cy="0"
					r={trackR}
					fill="none"
					stroke="var(--bp-fill-start)"
					strokeWidth={strokeW}
					strokeLinecap="round"
					strokeDasharray={`${fillLen} 9999`}
					transform="rotate(135)"
					style={{ transition: dragValue === null ? 'stroke-dasharray 120ms var(--ease-out-expo)' : 'none' }}
				/>
				{/* Position pointer — short accent tick at outer radius, no metallic disc */}
				<line
					x1="0"
					y1={-(trackR - strokeW)}
					x2="0"
					y2={-(trackR + strokeW / 2 + 6)}
					stroke="var(--bp-fill-start)"
					strokeWidth="4"
					strokeLinecap="round"
					transform={`rotate(${angle})`}
					style={{ transition: dragValue === null ? 'transform 120ms var(--ease-out-expo)' : 'none' }}
				/>
			</svg>
			<div style={{ position: 'relative', textAlign: 'center', pointerEvents: 'none', zIndex: 1 }}>
				{item.style.label && (
					<div
						style={{
							fontSize: '0.65em',
							color: 'var(--bp-muted-fg)',
							marginBottom: 4,
							textTransform: 'uppercase',
							letterSpacing: '0.08em',
							fontWeight: 700,
						}}
					>
						{item.style.label}
					</div>
				)}
				<div
					style={{
						fontWeight: 700,
						fontSize: '1.5em',
						letterSpacing: '-0.02em',
						fontVariantNumeric: 'tabular-nums',
					}}
				>
					{formatNumber(current)}
				</div>
			</div>
		</div>
	)
}

function clamp01(v: number) {
	return Math.max(0, Math.min(1, v))
}
function snapToStep(v: number, min: number, max: number, step: number) {
	if (step <= 0) return Math.max(min, Math.min(max, v))
	const snapped = Math.round((v - min) / step) * step + min
	return Math.max(min, Math.min(max, snapped))
}
function formatNumber(v: number) {
	if (Math.abs(v) >= 100) return v.toFixed(0)
	if (Math.abs(v) >= 10) return v.toFixed(1)
	return v.toFixed(2)
}
