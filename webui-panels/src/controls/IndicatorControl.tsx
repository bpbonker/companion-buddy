import type { PanelIndicatorItem } from '@companion-app/shared/Model/PanelModel.js'
import { asBool, type ControlRenderProps } from './index'

export function IndicatorControl(props: ControlRenderProps & { item: PanelIndicatorItem }) {
	const { item, value } = props
	const on = asBool(value, item.truthy)

	const colorOn = item.colorOn || 'var(--bp-ind-on)'
	const colorOff = item.colorOff || 'var(--bp-ind-off)'

	return (
		<div
			className="control control-indicator"
			data-on={on || undefined}
			style={{
				width: '100%',
				height: '100%',
				background: item.style.bg ?? 'var(--bp-track-bg)',
				border: item.style.border ?? 'var(--bp-frame-border)',
				borderRadius: item.style.radius ?? 14,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 12,
				padding: 12,
				color: item.style.fg ?? 'var(--bp-label-fg)',
				fontSize: item.style.fontSize ?? 14,
				fontWeight: 600,
				letterSpacing: '-0.01em',
				overflow: 'hidden',
			}}
		>
			<div
				style={{
					width: '34%',
					height: '34%',
					maxWidth: 40,
					maxHeight: 40,
					minWidth: 12,
					minHeight: 12,
					borderRadius: '50%',
					background: on ? colorOn : colorOff,
					transition: 'background 180ms var(--ease-out-expo)',
					flexShrink: 0,
				}}
			/>
			{item.style.label && (
				<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.style.label}</span>
			)}
		</div>
	)
}
