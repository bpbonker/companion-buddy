import type { PanelGroupItem } from '@companion-app/shared/Model/PanelModel.js'
import type { ControlRenderProps } from './index'

export function GroupControl(props: ControlRenderProps & { item: PanelGroupItem }) {
	const { item } = props
	const variant = item.variant ?? 'solid'

	// solid → opaque card (the brightest surface — controls sit ON TOP of it darker)
	// glass → translucent overlay with backdrop-blur (frosted-glass card)
	// ghost → transparent card with a hairline outline only
	const bg =
		variant === 'ghost' ? 'transparent' : variant === 'glass' ? 'rgba(255, 255, 255, 0.045)' : 'var(--bp-surface-bg)'

	const border =
		variant === 'ghost' ? '1px solid var(--bp-surface-border, rgba(255,255,255,0.10))' : 'var(--bp-surface-border)'

	const radius = item.style.radius ?? 18

	return (
		<div
			className="control control-group"
			data-variant={variant}
			style={{
				width: '100%',
				height: '100%',
				background: item.style.bg ?? bg,
				border: item.style.border ?? border,
				borderRadius: typeof radius === 'number' ? radius : radius,
				backdropFilter: variant === 'glass' ? 'blur(10px) saturate(120%)' : undefined,
				WebkitBackdropFilter: variant === 'glass' ? 'blur(10px) saturate(120%)' : undefined,
				overflow: 'hidden',
				position: 'relative',
			}}
		>
			{item.title && (
				<div
					style={{
						position: 'absolute',
						top: 14,
						left: 18,
						right: 18,
						fontSize: item.style.fontSize ?? 11,
						color: item.style.fg ?? 'var(--bp-muted-fg)',
						textTransform: 'uppercase',
						letterSpacing: '0.12em',
						fontWeight: 700,
						pointerEvents: 'none',
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
					}}
				>
					{item.title}
				</div>
			)}
		</div>
	)
}
