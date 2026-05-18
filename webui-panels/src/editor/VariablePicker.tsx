import { useEffect, useRef, useState } from 'react'
import { useFilteredVariables } from './VariablesContext'

export function VariablePicker(props: {
	value: string
	onChange: (next: string) => void
	placeholder?: string
	'data-testid'?: string
}) {
	const { value, onChange, placeholder } = props
	const [open, setOpen] = useState(false)
	const [filter, setFilter] = useState('')
	const [hoverIdx, setHoverIdx] = useState(0)
	const wrapRef = useRef<HTMLDivElement>(null)

	const matches = useFilteredVariables(filter)

	useEffect(() => {
		if (!open) return
		function onClickOutside(e: MouseEvent) {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', onClickOutside)
		return () => document.removeEventListener('mousedown', onClickOutside)
	}, [open])

	function commit(s: string) {
		onChange(s)
		setOpen(false)
		setFilter('')
	}

	return (
		<div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
			<input
				value={open ? filter : value}
				onChange={(e) => {
					setFilter(e.target.value)
					setOpen(true)
					setHoverIdx(0)
					onChange(e.target.value)
				}}
				onFocus={() => {
					setFilter(value)
					setOpen(true)
				}}
				placeholder={placeholder ?? 'custom:my_var'}
				data-testid={props['data-testid']}
				onKeyDown={(e) => {
					if (!open) return
					if (e.key === 'ArrowDown') {
						e.preventDefault()
						setHoverIdx((i) => Math.min(matches.length - 1, i + 1))
					} else if (e.key === 'ArrowUp') {
						e.preventDefault()
						setHoverIdx((i) => Math.max(0, i - 1))
					} else if (e.key === 'Enter') {
						const hit = matches[hoverIdx]
						if (hit) {
							e.preventDefault()
							commit(hit.fqn)
						}
					} else if (e.key === 'Escape') {
						setOpen(false)
					}
				}}
				style={{ fontFamily: 'var(--font-mono)', fontSize: 12, width: '100%' }}
				autoComplete="off"
				spellCheck={false}
			/>
			{open && (
				<div
					style={{
						position: 'absolute',
						top: '100%',
						left: 0,
						right: 0,
						zIndex: 100,
						marginTop: 2,
						background: '#fff',
						color: '#111',
						border: '1px solid #d0d0d0',
						borderRadius: 4,
						boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
						maxHeight: 280,
						overflowY: 'auto',
					}}
				>
					{matches.length === 0 && (
						<div style={{ padding: 10, color: '#9a9a9a', fontSize: 12 }}>
							No matches — type a name like <code>custom:my_var</code> and press Enter.
						</div>
					)}
					{matches.map((m, i) => (
						<button
							key={m.fqn}
							type="button"
							onMouseEnter={() => setHoverIdx(i)}
							onMouseDown={(e) => {
								e.preventDefault()
								commit(m.fqn)
							}}
							style={{
								display: 'block',
								width: '100%',
								textAlign: 'left',
								padding: '7px 10px',
								background: i === hoverIdx ? '#ffe7e9' : '#fff',
								color: '#111',
								border: 'none',
								borderBottom: '1px solid #f0f0f0',
								fontFamily: 'var(--font-mono)',
								fontSize: 12,
								cursor: 'pointer',
								borderRadius: 0,
							}}
						>
							<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
								<span style={{ fontWeight: 600, color: m.isCustom ? '#d50215' : '#0f172a' }}>{m.fqn}</span>
								<span style={{ color: '#9a9a9a', fontSize: 10, textTransform: 'uppercase' }}>
									{m.isCustom ? 'custom' : m.label}
								</span>
							</div>
							{m.description && (
								<div style={{ fontSize: 11, color: '#555', fontFamily: 'var(--font-sans)', marginTop: 1 }}>
									{m.description}
								</div>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	)
}
