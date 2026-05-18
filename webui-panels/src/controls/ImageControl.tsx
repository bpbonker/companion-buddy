import type { PanelImageItem } from '@companion-app/shared/Model/PanelModel.js'
import type { ControlRenderProps } from './index'

export function ImageControl(props: ControlRenderProps & { item: PanelImageItem }) {
	const { item } = props
	return (
		<div
			className="control control-image"
			style={{
				width: '100%',
				height: '100%',
				background: item.style.bg ?? 'transparent',
				borderRadius: item.style.radius ?? 0,
				border: item.style.border ?? 'none',
				overflow: 'hidden',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			{item.src ? (
				<img
					src={item.src}
					alt=""
					draggable={false}
					style={{
						width: '100%',
						height: '100%',
						objectFit: item.fit,
						userSelect: 'none',
						pointerEvents: 'none',
					}}
				/>
			) : (
				<span style={{ color: '#475569', fontSize: 11 }}>no image</span>
			)}
		</div>
	)
}
