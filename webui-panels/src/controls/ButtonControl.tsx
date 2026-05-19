import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PanelButtonItem } from '@companion-app/shared/Model/PanelModel.js'
import { asBool, asText, type ControlRenderProps } from './index'
import { PinKeypad } from './PinKeypad'

export function ButtonControl(props: ControlRenderProps & { item: PanelButtonItem }) {
	const { item, mode, value, onPress, onWriteVar, panelPin } = props
	const [localOn, setLocalOn] = useState(false)
	const [pinPrompt, setPinPrompt] = useState(false)
	const navigate = useNavigate()
	const externalOn = item.stateVar ? asBool(value) : localOn
	const isOn = externalOn

	const label = asText(item.style.label ?? item.id)
	const interactive = mode === 'runtime'
	// Only gate if the button asks for a PIN AND the panel has one set. Otherwise the option
	// is configured but inert — better than silently failing the press.
	const pinActive = !!item.requirePin && !!panelPin && panelPin.length > 0

	function fire(pressed: boolean) {
		if (!interactive) return

		// Nav buttons short-circuit any var-write or mode logic — they just navigate the kiosk
		// to another panel on press-down. SPA-navigate via react-router (no full reload) so the
		// app shell stays mounted and there's no white flash. The current device's token is
		// preserved so the new panel opens authenticated. Only fires on press-down.
		if (item.navigateTo && pressed) {
			const params = new URLSearchParams(window.location.search)
			const token = params.get('token') ?? ''
			navigate(`/panel/${encodeURIComponent(item.navigateTo)}?token=${encodeURIComponent(token)}`, {
				replace: false,
			})
			return
		}

		if (item.mode === 'toggle') {
			if (!pressed) return
			const next = !isOn
			setLocalOn(next)
			if (item.writeVar !== undefined) {
				onWriteVar?.(item.writeVar, next ? (item.writeValue ?? 1) : (item.writeValueReleased ?? 0))
			}
			onPress?.(next)
			return
		}
		if (item.mode === 'momentary') {
			setLocalOn(pressed)
			if (item.writeVar !== undefined) {
				onWriteVar?.(item.writeVar, pressed ? (item.writeValue ?? 1) : (item.writeValueReleased ?? 0))
			}
			onPress?.(pressed)
			return
		}
		// press: trigger only on press-down
		if (pressed) {
			if (item.writeVar !== undefined) onWriteVar?.(item.writeVar, item.writeValue ?? 1)
			onPress?.(true)
			setLocalOn(true)
			setTimeout(() => setLocalOn(false), 140)
		}
	}

	const bg = item.style.bg ?? (isOn ? 'var(--bp-btn-bg-pressed)' : 'var(--bp-btn-bg)')
	const radius = item.style.radius ?? 'var(--bp-btn-radius)'
	const fg = item.style.fg ?? (isOn ? 'var(--bp-btn-fg-pressed)' : 'var(--bp-btn-fg)')

	return (
		<div
			className="control control-button"
			data-pressed={isOn || undefined}
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				flexDirection: 'column',
				gap: 6,
				background: bg,
				color: fg,
				borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
				border: item.style.border ?? 'var(--bp-btn-border)',
				boxShadow: 'var(--bp-btn-shadow)',
				fontWeight: 600,
				fontSize: item.style.fontSize ?? 15,
				letterSpacing: '-0.01em',
				cursor: interactive ? 'pointer' : 'default',
				transition: 'background 140ms var(--ease-out-expo), color 140ms, transform 80ms',
				transform: isOn ? 'scale(0.98)' : 'scale(1)',
				padding: 12,
				overflow: 'hidden',
				position: 'relative',
				userSelect: 'none',
			}}
			onPointerDown={(e) => {
				if (!interactive) return
				if (pinActive) {
					// Don't capture the pointer when we're going to show a modal — the keypad needs
					// to receive its own pointer events. Also don't fire(true) yet; we wait for unlock.
					setPinPrompt(true)
					return
				}
				e.currentTarget.setPointerCapture(e.pointerId)
				fire(true)
			}}
			onPointerUp={() => interactive && !pinActive && fire(false)}
			onPointerCancel={() => interactive && !pinActive && fire(false)}
			onContextMenu={(e) => e.preventDefault()}
		>
			{item.style.icon && <div style={{ fontSize: '1.4em', opacity: 0.95, lineHeight: 1 }}>{item.style.icon}</div>}
			<div style={{ lineHeight: 1.15, textAlign: 'center', wordBreak: 'break-word' }}>{label}</div>
			{pinPrompt && panelPin && (
				<PinKeypad
					expected={panelPin}
					label={`Enter PIN to ${item.mode === 'toggle' ? 'toggle' : 'activate'} "${label}"`}
					onSuccess={() => {
						setPinPrompt(false)
						// Run a full down/up cycle so momentary buttons send both edges
						// even though the user never physically held the button down.
						fire(true)
						if (item.mode === 'momentary') {
							setTimeout(() => fire(false), 120)
						}
					}}
					onCancel={() => setPinPrompt(false)}
				/>
			)}
		</div>
	)
}
