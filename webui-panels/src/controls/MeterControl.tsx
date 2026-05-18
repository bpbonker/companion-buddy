import type { PanelMeterItem } from '@companion-app/shared/Model/PanelModel.js'
import { asNumber, type ControlRenderProps } from './index'

export function MeterControl(props: ControlRenderProps & { item: PanelMeterItem }) {
	const { item, value } = props
	const v = asNumber(value, item.min)
	const pct = clamp01((v - item.min) / (item.max - item.min || 1))
	const horizontal = item.orientation === 'horizontal'

	// Single-color accent fill matches the dashboard reference aesthetic.
	// If the user explicitly set colorFill to something other than the legacy default, honor it.
	const fill = item.colorFill && item.colorFill !== '#22c55e' ? item.colorFill : 'var(--bp-meter-gradient)'

	return (
		<div
			className="control control-meter"
			style={{
				width: '100%',
				height: '100%',
				background: item.style.bg ?? 'var(--bp-track-bg)',
				border: item.style.border ?? 'var(--bp-frame-border)',
				borderRadius: item.style.radius ?? 14,
				position: 'relative',
				overflow: 'hidden',
			}}
		>
			<div
				style={{
					position: 'absolute',
					left: 0,
					bottom: 0,
					width: horizontal ? `${pct * 100}%` : '100%',
					height: horizontal ? '100%' : `${pct * 100}%`,
					background: fill,
					transition: 'width 140ms var(--ease-out-expo), height 140ms var(--ease-out-expo)',
				}}
			/>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					color: item.style.fg ?? 'var(--bp-label-fg)',
					pointerEvents: 'none',
					gap: 2,
					padding: 8,
					textAlign: 'center',
				}}
			>
				{item.style.label && (
					<div
						style={{
							fontSize: '0.65em',
							textTransform: 'uppercase',
							letterSpacing: '0.08em',
							fontWeight: 700,
							opacity: 0.6,
						}}
					>
						{item.style.label}
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
					{formatNumber(v)}
				</div>
			</div>
		</div>
	)
}

function clamp01(v: number) {
	return Math.max(0, Math.min(1, v))
}
function formatNumber(v: number) {
	if (Math.abs(v) >= 100) return v.toFixed(0)
	if (Math.abs(v) >= 10) return v.toFixed(1)
	return v.toFixed(2)
}
