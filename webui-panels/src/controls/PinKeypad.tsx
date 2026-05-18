import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
	expected: string
	label?: string
	onSuccess: () => void
	onCancel: () => void
}

/**
 * Touch-friendly numeric keypad overlay that gates a single action. Auto-submits as soon as
 * the entered length matches the expected PIN length — correct fires onSuccess, wrong clears
 * the buffer with a shake. Cancel button dismisses without firing.
 *
 * Plain-text PIN compare on purpose (see PanelSchema.pin) — this is a kiosk press-by-accident
 * gate, not a security boundary.
 */
export function PinKeypad(props: Props) {
	const { expected, label, onSuccess, onCancel } = props
	const [entered, setEntered] = useState('')
	const [shake, setShake] = useState(false)
	const submittedRef = useRef(false)

	useEffect(() => {
		if (entered.length < expected.length) return
		if (submittedRef.current) return
		if (entered === expected) {
			submittedRef.current = true
			onSuccess()
		} else {
			setShake(true)
			setTimeout(() => {
				setEntered('')
				setShake(false)
			}, 350)
		}
	}, [entered, expected, onSuccess])

	function press(digit: string) {
		setEntered((e) => (e.length >= expected.length ? e : e + digit))
	}

	function backspace() {
		setEntered((e) => e.slice(0, -1))
	}

	// Render via portal to <body>. The kiosk-stage has a CSS transform applied for
	// stretch-to-fit, which makes it the containing block for "position: fixed" descendants —
	// without the portal, this overlay would be trapped inside the scaled stage and the
	// real-viewport clicks on the keypad get intercepted by the stage itself.
	return createPortal(
		<div
			onPointerDown={(e) => e.stopPropagation()}
			style={{
				position: 'fixed',
				inset: 0,
				background: 'rgba(0,0,0,0.65)',
				backdropFilter: 'blur(6px)',
				WebkitBackdropFilter: 'blur(6px)',
				zIndex: 1000,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				touchAction: 'manipulation',
			}}
			data-testid="pin-keypad"
		>
			<div
				style={{
					background: '#0f172a',
					border: '1px solid #1e293b',
					borderRadius: 16,
					padding: 24,
					width: 'min(90vw, 320px)',
					boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
					animation: shake ? 'pin-shake 320ms' : undefined,
				}}
			>
				<div style={{ color: '#e2e8f0', fontSize: 14, marginBottom: 6, textAlign: 'center', fontWeight: 600 }}>
					{label ?? 'Enter PIN'}
				</div>
				<div
					style={{
						display: 'flex',
						gap: 8,
						justifyContent: 'center',
						marginBottom: 18,
						minHeight: 24,
					}}
				>
					{Array.from({ length: expected.length }).map((_, i) => (
						<span
							key={i}
							style={{
								width: 14,
								height: 14,
								borderRadius: '50%',
								background: i < entered.length ? (shake ? '#ef4444' : '#3b82f6') : 'transparent',
								border: '2px solid #475569',
								transition: 'background 120ms',
							}}
						/>
					))}
				</div>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
					{['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
						<KeypadButton key={d} onPress={() => press(d)}>
							{d}
						</KeypadButton>
					))}
					<KeypadButton variant="ghost" onPress={onCancel}>
						Cancel
					</KeypadButton>
					<KeypadButton onPress={() => press('0')}>0</KeypadButton>
					<KeypadButton variant="ghost" onPress={backspace}>
						⌫
					</KeypadButton>
				</div>
			</div>
			<style>{`@keyframes pin-shake { 0%,100%{ transform: translateX(0) } 20%,60%{ transform: translateX(-8px) } 40%,80%{ transform: translateX(8px) } }`}</style>
		</div>,
		document.body
	)
}

function KeypadButton(props: { children: React.ReactNode; onPress: () => void; variant?: 'ghost' }) {
	return (
		<button
			onClick={props.onPress}
			style={{
				background: props.variant === 'ghost' ? 'transparent' : '#1e293b',
				color: '#e2e8f0',
				border: props.variant === 'ghost' ? '1px solid #334155' : '1px solid #334155',
				borderRadius: 10,
				padding: '16px 0',
				fontSize: 22,
				fontWeight: 600,
				fontFamily: 'var(--font-kiosk)',
				cursor: 'pointer',
				touchAction: 'manipulation',
				userSelect: 'none',
			}}
		>
			{props.children}
		</button>
	)
}
