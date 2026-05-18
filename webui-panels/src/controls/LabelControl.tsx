import type { PanelLabelItem } from '@companion-app/shared/Model/PanelModel.js'
import { asText, type ControlRenderProps } from './index'

export function LabelControl(props: ControlRenderProps & { item: PanelLabelItem }) {
	const { item, value } = props
	const text = item.bindVar ? asText(value) : item.text

	return (
		<div
			className="control control-label"
			style={{
				width: '100%',
				height: '100%',
				background: item.style.bg ?? 'transparent',
				color: item.style.fg ?? 'var(--bp-label-fg)',
				border: item.style.border ?? 'none',
				borderRadius: item.style.radius ?? 0,
				fontSize: item.style.fontSize ?? 22,
				padding: 8,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				textAlign: 'center',
				whiteSpace: 'pre-wrap',
				overflow: 'hidden',
				fontWeight: 700,
				lineHeight: 1.1,
				letterSpacing: '-0.02em',
				fontVariantNumeric: 'tabular-nums',
			}}
		>
			{text}
		</div>
	)
}
