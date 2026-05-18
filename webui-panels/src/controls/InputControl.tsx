import { useEffect, useState } from 'react'
import type { PanelInputItem } from '@companion-app/shared/Model/PanelModel.js'
import { asText, type ControlRenderProps } from './index'

export function InputControl(props: ControlRenderProps & { item: PanelInputItem }) {
	const { item, mode, value, onWriteVar } = props
	const externalText = asText(value)
	// Local draft so the user can type freely without the field snapping back to the
	// upstream value on every var push. Mirrored from external while not focused.
	const [draft, setDraft] = useState<string>(externalText)
	const [focused, setFocused] = useState(false)

	useEffect(() => {
		if (!focused) setDraft(externalText)
	}, [externalText, focused])

	const interactive = mode === 'runtime'

	function commit() {
		if (!interactive) return
		if (item.inputType === 'number') {
			const trimmed = draft.trim()
			if (trimmed === '') return
			const n = Number(trimmed)
			if (!Number.isFinite(n)) {
				setDraft(externalText)
				return
			}
			let v = n
			if (item.min !== undefined) v = Math.max(item.min, v)
			if (item.max !== undefined) v = Math.min(item.max, v)
			if (item.step && item.step > 0) {
				const base = item.min ?? 0
				v = Math.round((v - base) / item.step) * item.step + base
			}
			setDraft(String(v))
			onWriteVar?.(item.bindVar, v)
		} else {
			onWriteVar?.(item.bindVar, draft)
		}
	}

	const label = item.style.label

	return (
		<div
			className="control control-input"
			style={{
				width: '100%',
				height: '100%',
				background: item.style.bg ?? 'var(--bp-track-bg)',
				border: item.style.border ?? '1px solid var(--bp-divider)',
				borderRadius: item.style.radius ?? 8,
				padding: 8,
				display: 'flex',
				flexDirection: 'column',
				gap: 4,
				justifyContent: 'center',
				overflow: 'hidden',
			}}
		>
			{label && (
				<div
					style={{
						fontSize: '0.65em',
						color: 'var(--bp-muted-fg)',
						textTransform: 'uppercase',
						letterSpacing: '0.08em',
						fontWeight: 700,
					}}
				>
					{label}
				</div>
			)}
			<input
				type={item.inputType === 'number' ? 'number' : 'text'}
				inputMode={item.inputType === 'number' ? 'decimal' : 'text'}
				value={draft}
				placeholder={item.placeholder}
				min={item.inputType === 'number' ? item.min : undefined}
				max={item.inputType === 'number' ? item.max : undefined}
				step={item.inputType === 'number' ? item.step : undefined}
				readOnly={!interactive}
				onChange={(e) => setDraft(e.target.value)}
				onFocus={() => setFocused(true)}
				onBlur={() => {
					setFocused(false)
					commit()
				}}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						;(e.target as HTMLInputElement).blur()
					} else if (e.key === 'Escape') {
						setDraft(externalText)
						;(e.target as HTMLInputElement).blur()
					}
				}}
				style={{
					width: '100%',
					background: 'transparent',
					color: item.style.fg ?? 'var(--bp-label-fg)',
					border: 'none',
					outline: 'none',
					fontSize: item.style.fontSize ?? 22,
					fontWeight: 600,
					fontVariantNumeric: 'tabular-nums',
					padding: 0,
				}}
			/>
		</div>
	)
}
