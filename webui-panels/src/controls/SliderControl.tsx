import { useEffect, useRef, useState } from 'react'
import type { PanelSliderItem } from '@companion-app/shared/Model/PanelModel.js'
import { asNumber, type ControlRenderProps } from './index'

export function SliderControl(props: ControlRenderProps & { item: PanelSliderItem }) {
	const { item, mode, value, onWriteVar } = props
	const externalValue = asNumber(value, item.min)
	const [dragValue, setDragValue] = useState<number | null>(null)
	const current = dragValue ?? externalValue
	const pct = clamp01((current - item.min) / (item.max - item.min || 1))

	const lastSendRef = useRef(0)
	const trailingRef = useRef<number | null>(null)
	const interactive = mode === 'runtime'

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

	const trackRef = useRef<HTMLDivElement>(null)
	const horizontal = item.orientation === 'horizontal'
	const radius = (item.style.radius ?? 12) as number | string

	// Thumb is always smaller than the track so it can sit flush at the extremes without clipping.
	const thumbLong = 22

	function handlePointer(clientX: number, clientY: number) {
		const el = trackRef.current
		if (!el) return
		const rect = el.getBoundingClientRect()
		// Pointer space → percentage along the travel axis, accounting for the thumb so
		// clicking near the edges still maps to min/max instead of getting "stuck" half a thumb in.
		const travel = horizontal ? rect.width - thumbLong : rect.height - thumbLong
		let p: number
		if (horizontal) {
			const x = clientX - rect.left - thumbLong / 2
			p = travel > 0 ? x / travel : 0
		} else {
			const y = clientY - rect.top - thumbLong / 2
			p = travel > 0 ? 1 - y / travel : 0
		}
		p = clamp01(p)
		const v = item.min + p * (item.max - item.min)
		setDragValue(v)
		send(v)
	}

	const valueText = formatNumber(current)
	const labelText = item.style.label

	// Position the thumb so its near-edge stays flush with the track edge at min/max.
	// At pct=0 → 0; at pct=1 → (100% − thumbLong). No clipping.
	const thumbOffset = `calc(${pct * 100}% - ${pct * thumbLong}px)`
	// The fill should reach the thumb CENTER, which sits at thumbOffset + thumbLong/2.
	const fillLen = `calc(${pct * 100}% - ${pct * thumbLong}px + ${thumbLong / 2}px)`

	return (
		<div
			ref={trackRef}
			className="control control-slider"
			style={{
				width: '100%',
				height: '100%',
				background: item.style.bg ?? 'var(--bp-track-bg)',
				border: item.style.border ?? 'var(--bp-frame-border)',
				borderRadius: typeof radius === 'number' ? radius : radius,
				position: 'relative',
				overflow: 'hidden',
				cursor: interactive ? 'pointer' : 'default',
				boxShadow: 'var(--bp-track-shadow)',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: horizontal ? 'center' : 'flex-end',
				padding: horizontal ? '8px 0' : '0 8px',
			}}
			onPointerDown={(e) => {
				if (!interactive) return
				e.currentTarget.setPointerCapture(e.pointerId)
				handlePointer(e.clientX, e.clientY)
			}}
			onPointerMove={(e) => {
				if (!interactive) return
				if (e.buttons === 0) return
				handlePointer(e.clientX, e.clientY)
			}}
			onPointerUp={() => setDragValue(null)}
			onPointerCancel={() => setDragValue(null)}
			onContextMenu={(e) => e.preventDefault()}
		>
			{/* Fill — solid accent, no gradient */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					bottom: 0,
					width: horizontal ? fillLen : '100%',
					height: horizontal ? '100%' : fillLen,
					background: 'var(--bp-fill-start)',
					transition: dragValue === null ? 'all 120ms var(--ease-out-expo)' : 'none',
					pointerEvents: 'none',
				}}
			/>

			{/* Thumb — solid, flat, no chrome */}
			<div
				style={{
					position: 'absolute',
					width: horizontal ? thumbLong : `calc(100% - 12px)`,
					height: horizontal ? `calc(100% - 12px)` : thumbLong,
					background: 'var(--bp-thumb-bg)',
					borderRadius: 999,
					boxShadow: 'var(--bp-thumb-shadow)',
					pointerEvents: 'none',
					transition: dragValue === null ? 'all 120ms var(--ease-out-expo)' : 'none',
					...(horizontal ? { left: thumbOffset, top: 6 } : { bottom: thumbOffset, left: 6 }),
				}}
			/>

			{/* Label + value: stacked, non-overlapping with thumb at extremes thanks to padding */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					color: 'var(--bp-label-fg)',
					pointerEvents: 'none',
					gap: 2,
					padding: horizontal ? '0 12px' : '12px 0',
					textAlign: 'center',
				}}
			>
				{labelText && (
					<div
						style={{
							fontSize: '0.65em',
							textTransform: 'uppercase',
							letterSpacing: '0.08em',
							fontWeight: 700,
							opacity: 0.6,
						}}
					>
						{labelText}
					</div>
				)}
				<div
					style={{
						fontSize: item.style.fontSize ?? 18,
						fontWeight: 700,
						fontVariantNumeric: 'tabular-nums',
						letterSpacing: '-0.02em',
					}}
				>
					{valueText}
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
