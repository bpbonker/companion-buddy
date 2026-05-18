import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { Panel, PanelItem } from '@companion-app/shared/Model/PanelModel.js'
import { PANEL_THEME_LIST } from '../themes/themes'
import { useTRPC } from '../trpc'
import { CanvasSizePicker } from './CanvasSizePicker'
import { VariablePicker } from './VariablePicker'

export function Inspector(props: {
	selected: PanelItem | null
	panel: Panel
	onChange: (patch: Partial<PanelItem>) => void
	onPanelChange: (patch: Partial<Panel>) => void
	onDelete: () => void
}) {
	const { selected, panel, onChange, onPanelChange, onDelete } = props

	if (!selected) {
		return <PanelLevelInspector panel={panel} onPanelChange={onPanelChange} />
	}

	return (
		<div className="inspector">
			<h3>
				{selected.kind} · <span style={{ fontFamily: 'var(--font-mono)' }}>{selected.id}</span>
			</h3>

			<div className="field">
				<label>Position (x, y)</label>
				<div className="row">
					<input type="number" value={selected.x} onChange={(e) => onChange({ x: +e.target.value || 0 })} />
					<input type="number" value={selected.y} onChange={(e) => onChange({ y: +e.target.value || 0 })} />
				</div>
			</div>
			<div className="field">
				<label>Size (w, h)</label>
				<div className="row">
					<input
						type="number"
						value={selected.w}
						onChange={(e) => onChange({ w: Math.max(1, +e.target.value || 1) })}
					/>
					<input
						type="number"
						value={selected.h}
						onChange={(e) => onChange({ h: Math.max(1, +e.target.value || 1) })}
					/>
				</div>
			</div>

			<KindFields item={selected} onChange={onChange} />

			<div className="inspector-section">
				<h3>Style</h3>
				<StyleFields item={selected} onChange={onChange} />
			</div>

			<div className="inspector-section">
				<button className="danger" onClick={onDelete} data-testid="delete-item">
					Delete item
				</button>
			</div>
		</div>
	)
}

function PanelLevelInspector(props: { panel: Panel; onPanelChange: (patch: Partial<Panel>) => void }) {
	const { panel, onPanelChange } = props
	return (
		<div className="inspector">
			<h3>Panel settings</h3>
			<div className="field">
				<label>Name</label>
				<input value={panel.name} onChange={(e) => onPanelChange({ name: e.target.value })} />
			</div>
			<div className="field">
				<label>URL slug</label>
				<input
					value={panel.slug}
					onChange={(e) => onPanelChange({ slug: e.target.value })}
					style={{ fontFamily: 'var(--font-mono)' }}
				/>
			</div>

			<div className="inspector-section">
				<h3>Canvas size</h3>
				<CanvasSizePicker panel={panel} onPanelChange={onPanelChange} />
			</div>

			<div className="inspector-section">
				<h3>Kiosk theme</h3>
				<div className="field">
					<label>Preset</label>
					<select
						value={panel.theme ?? 'studio-dark'}
						onChange={(e) => onPanelChange({ theme: e.target.value as any })}
						data-testid="panel-theme"
					>
						{PANEL_THEME_LIST.map((t) => (
							<option key={t.id} value={t.id}>
								{t.label}
							</option>
						))}
					</select>
					<div style={{ fontSize: 11, color: 'var(--cmp-card-muted)', marginTop: 4 }}>
						{PANEL_THEME_LIST.find((t) => t.id === (panel.theme ?? 'studio-dark'))?.description}
					</div>
				</div>
				<div className="field">
					<label>Accent color (overrides theme)</label>
					<div className="color-with-clear">
						<input
							type="color"
							value={panel.accentColor ?? '#2563eb'}
							onChange={(e) => onPanelChange({ accentColor: e.target.value })}
							data-testid="panel-accent"
						/>
						{panel.accentColor && (
							<button className="clear" onClick={() => onPanelChange({ accentColor: null } as any)}>
								Reset
							</button>
						)}
					</div>
				</div>
				<div className="field">
					<label>Background color (overrides theme)</label>
					<div className="color-with-clear">
						<input
							type="color"
							value={panel.bgColor ?? '#0b1220'}
							onChange={(e) => onPanelChange({ bgColor: e.target.value })}
							data-testid="panel-bg"
						/>
						{panel.bgColor && (
							<button className="clear" onClick={() => onPanelChange({ bgColor: null } as any)}>
								Reset
							</button>
						)}
					</div>
				</div>
				<div className="field">
					<label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
						<input
							type="checkbox"
							checked={!!panel.frame}
							onChange={(e) => onPanelChange({ frame: e.target.checked })}
							style={{ width: 'auto', height: 'auto', cursor: 'pointer' }}
							data-testid="panel-frame"
						/>
						<span style={{ textTransform: 'none', letterSpacing: 'normal', opacity: 1, fontWeight: 400, fontSize: 13 }}>
							Hardware bezel frame
						</span>
					</label>
				</div>
			</div>

			<div className="inspector-section">
				<h3>Access PIN</h3>
				<div className="field">
					<label>PIN (gates buttons marked "Require PIN")</label>
					<input
						type="text"
						inputMode="numeric"
						autoComplete="off"
						value={panel.pin ?? ''}
						onChange={(e) => onPanelChange({ pin: e.target.value || (null as any) })}
						placeholder="e.g. 1234 (leave blank for no PIN)"
						style={{ fontFamily: 'var(--font-mono)' }}
						data-testid="panel-pin"
					/>
					<div style={{ fontSize: 11, color: 'var(--cmp-card-muted)', marginTop: 4 }}>
						Stored as plain text. This is a kiosk-mode "prevent accidental press" gate — not a security boundary against
						attackers. A button only prompts for the PIN when the panel has one set.
					</div>
				</div>
			</div>

			<KioskAddressSection />

			<div className="inspector-section">
				<div className="empty-state">
					Click an item on the canvas to edit it.
					<br />
					Drag from the palette to place a new control.
				</div>
			</div>
		</div>
	)
}

function NavigateToField(props: { value: string | undefined; onChange: (slug: string | undefined) => void }) {
	const { value, onChange } = props
	const trpc = useTRPC()
	const listQuery = useQuery(trpc.panels.list.queryOptions())
	const panels = (listQuery.data as Array<{ id: string; slug: string; name: string }> | undefined) ?? []
	return (
		<div className="field">
			<label>Navigate to panel (overrides write-variable)</label>
			<select
				value={value ?? ''}
				onChange={(e) => onChange(e.target.value || undefined)}
				data-testid="field-navigateTo"
			>
				<option value="">— off (normal button) —</option>
				{panels.map((p) => (
					<option key={p.id} value={p.slug}>
						{p.name} ({p.slug})
					</option>
				))}
			</select>
			<div style={{ fontSize: 11, color: 'var(--cmp-card-muted)', marginTop: 4 }}>
				When set, pressing the button takes the kiosk to that panel using the same device token.
			</div>
		</div>
	)
}

function KioskAddressSection() {
	const trpc = useTRPC()
	const queryClient = useQueryClient()
	const hostQuery = useQuery(trpc.panels.settings.getKioskHost.queryOptions())
	const ifacesQuery = useQuery(trpc.panels.networkInterfaces.queryOptions())
	const [draft, setDraft] = useState<string>('')

	// Hydrate the draft once the server value arrives. We deliberately don't sync after every fetch
	// so an in-progress edit isn't clobbered by a query refetch.
	useEffect(() => {
		if (hostQuery.data) setDraft(hostQuery.data.host ?? '')
	}, [hostQuery.data])

	const saveMutation = useMutation(
		trpc.panels.settings.setKioskHost.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.panels.settings.getKioskHost.queryKey() })
			},
		})
	)

	const ifaces = ifacesQuery.data ?? []
	const currentHost = hostQuery.data?.host ?? ''
	const dirty = draft.trim() !== currentHost.trim()

	function commit(value: string) {
		saveMutation.mutate({ host: value.trim() || null })
	}

	return (
		<div className="inspector-section">
			<h3>Kiosk address</h3>
			<div className="field">
				<label>External URL for QR codes (overrides browser origin)</label>
				<div className="row">
					<input
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						placeholder="http://192.168.1.10:8000"
						style={{ fontFamily: 'var(--font-mono)' }}
						data-testid="kiosk-host-input"
					/>
					<button
						className={dirty ? 'primary' : ''}
						disabled={!dirty || saveMutation.isPending}
						onClick={() => commit(draft)}
						data-testid="kiosk-host-save"
					>
						{saveMutation.isPending ? 'Saving…' : 'Save'}
					</button>
					{currentHost && (
						<button
							onClick={() => {
								setDraft('')
								commit('')
							}}
							title="Clear and fall back to the browser's address"
						>
							Clear
						</button>
					)}
				</div>
				<div style={{ fontSize: 11, color: 'var(--cmp-card-muted)', marginTop: 4 }}>
					Tablets on the LAN can't reach <code>localhost</code>. Set this to the IP/hostname of this Companion server as
					seen by the tablet — it's used when generating onboarding QR codes.
				</div>
			</div>
			{ifaces.length > 0 && (
				<div className="field">
					<label>Detected LAN addresses</label>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
						{ifaces.map((i) => {
							const url = `http://${i.address}:${window.location.port || '8000'}`
							return (
								<button
									key={`${i.iface}-${i.address}`}
									className="ghost"
									title={`Use ${i.iface}`}
									onClick={() => {
										setDraft(url)
										commit(url)
									}}
									style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
								>
									{i.address}
									<span style={{ opacity: 0.6, marginLeft: 4 }}>({i.iface})</span>
								</button>
							)
						})}
					</div>
				</div>
			)}
		</div>
	)
}

function KindFields(props: { item: PanelItem; onChange: (patch: Partial<PanelItem>) => void }) {
	const { item, onChange } = props
	switch (item.kind) {
		case 'button':
			return (
				<>
					<div className="field">
						<label>Mode</label>
						<select value={item.mode} onChange={(e) => onChange({ mode: e.target.value as any })}>
							<option value="press">press</option>
							<option value="momentary">momentary</option>
							<option value="toggle">toggle</option>
						</select>
					</div>
					<div className="field">
						<label>Write variable</label>
						<VariablePicker
							value={item.writeVar ?? ''}
							onChange={(v) => onChange({ writeVar: v })}
							data-testid="field-writeVar"
						/>
					</div>
					<div className="field">
						<label>Press value</label>
						<input
							value={String(item.writeValue ?? '')}
							onChange={(e) => onChange({ writeValue: parseAuto(e.target.value) })}
							data-testid="field-writeValue"
						/>
					</div>
					<div className="field">
						<label>Release value (momentary/toggle-off)</label>
						<input
							value={String(item.writeValueReleased ?? '')}
							onChange={(e) => onChange({ writeValueReleased: parseAuto(e.target.value) })}
						/>
					</div>
					<div className="field">
						<label>State variable (lights button when truthy)</label>
						<VariablePicker value={item.stateVar ?? ''} onChange={(v) => onChange({ stateVar: v })} />
					</div>
					<div className="field">
						<label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
							<input
								type="checkbox"
								checked={!!item.requirePin}
								onChange={(e) => onChange({ requirePin: e.target.checked })}
								style={{ width: 'auto', height: 'auto', cursor: 'pointer' }}
								data-testid="field-requirePin"
							/>
							<span
								style={{ textTransform: 'none', letterSpacing: 'normal', opacity: 1, fontWeight: 400, fontSize: 13 }}
							>
								Require PIN to press
							</span>
						</label>
						{item.requirePin && (
							<div style={{ fontSize: 11, color: 'var(--cmp-card-muted)', marginTop: 4 }}>
								PIN is set in <strong>Panel settings → Access PIN</strong> (deselect this button to get there). All
								PIN-protected buttons on this panel share the same PIN.
							</div>
						)}
					</div>
					<NavigateToField value={item.navigateTo} onChange={(slug) => onChange({ navigateTo: slug })} />
				</>
			)
		case 'slider':
		case 'knob':
			return (
				<>
					<div className="field">
						<label>Bind variable</label>
						<VariablePicker
							value={item.bindVar}
							onChange={(v) => onChange({ bindVar: v })}
							data-testid="field-bindVar"
						/>
					</div>
					<div className="field">
						<label>Min / Max / Step</label>
						<div className="row">
							<input type="number" value={item.min} onChange={(e) => onChange({ min: +e.target.value || 0 })} />
							<input type="number" value={item.max} onChange={(e) => onChange({ max: +e.target.value || 0 })} />
							<input type="number" value={item.step} onChange={(e) => onChange({ step: +e.target.value || 1 })} />
						</div>
					</div>
					{item.kind === 'slider' && (
						<div className="field">
							<label>Orientation</label>
							<select value={item.orientation} onChange={(e) => onChange({ orientation: e.target.value as any })}>
								<option value="horizontal">horizontal</option>
								<option value="vertical">vertical</option>
							</select>
						</div>
					)}
					<div className="field">
						<label>Send rate (ms)</label>
						<input
							type="number"
							value={item.sendRateMs}
							onChange={(e) => onChange({ sendRateMs: Math.max(10, +e.target.value || 50) })}
						/>
					</div>
				</>
			)
		case 'indicator':
			return (
				<>
					<div className="field">
						<label>Bind variable</label>
						<VariablePicker
							value={item.bindVar}
							onChange={(v) => onChange({ bindVar: v })}
							data-testid="field-bindVar"
						/>
					</div>
					<div className="field">
						<label>Truthy expression (optional)</label>
						<input value={item.truthy ?? ''} onChange={(e) => onChange({ truthy: e.target.value })} placeholder="> 0" />
					</div>
					<div className="field">
						<label>Colors (on / off)</label>
						<div className="row">
							<input type="color" value={item.colorOn} onChange={(e) => onChange({ colorOn: e.target.value })} />
							<input type="color" value={item.colorOff} onChange={(e) => onChange({ colorOff: e.target.value })} />
						</div>
						<div style={{ fontSize: 10, color: 'var(--cmp-muted)' }}>Leave default to use the theme</div>
					</div>
				</>
			)
		case 'meter':
			return (
				<>
					<div className="field">
						<label>Bind variable</label>
						<VariablePicker
							value={item.bindVar}
							onChange={(v) => onChange({ bindVar: v })}
							data-testid="field-bindVar"
						/>
					</div>
					<div className="field">
						<label>Min / Max</label>
						<div className="row">
							<input type="number" value={item.min} onChange={(e) => onChange({ min: +e.target.value || 0 })} />
							<input type="number" value={item.max} onChange={(e) => onChange({ max: +e.target.value || 100 })} />
						</div>
					</div>
					<div className="field">
						<label>Orientation</label>
						<select value={item.orientation} onChange={(e) => onChange({ orientation: e.target.value as any })}>
							<option value="horizontal">horizontal</option>
							<option value="vertical">vertical</option>
						</select>
					</div>
					<div className="field">
						<label>Fill color (leave default to use theme VU gradient)</label>
						<input type="color" value={item.colorFill} onChange={(e) => onChange({ colorFill: e.target.value })} />
					</div>
				</>
			)
		case 'label':
			return (
				<>
					<div className="field">
						<label>Text</label>
						<input value={item.text} onChange={(e) => onChange({ text: e.target.value })} />
					</div>
					<div className="field">
						<label>Bind variable (overrides text)</label>
						<VariablePicker
							value={item.bindVar ?? ''}
							onChange={(v) => onChange({ bindVar: v || undefined })}
							data-testid="field-bindVar"
						/>
					</div>
				</>
			)
		case 'image':
			return (
				<>
					<div className="field">
						<label>Source URL</label>
						<input value={item.src} onChange={(e) => onChange({ src: e.target.value })} placeholder="https://…" />
					</div>
					<div className="field">
						<label>Fit</label>
						<select value={item.fit} onChange={(e) => onChange({ fit: e.target.value as any })}>
							<option value="contain">contain</option>
							<option value="cover">cover</option>
							<option value="fill">fill</option>
						</select>
					</div>
				</>
			)
		case 'input':
			return (
				<>
					<div className="field">
						<label>Bind variable (commit on Enter / blur)</label>
						<VariablePicker
							value={item.bindVar}
							onChange={(v) => onChange({ bindVar: v })}
							data-testid="field-bindVar"
						/>
					</div>
					<div className="field">
						<label>Type</label>
						<select
							value={item.inputType}
							onChange={(e) => onChange({ inputType: e.target.value as any })}
							data-testid="field-inputType"
						>
							<option value="number">number</option>
							<option value="text">text</option>
						</select>
					</div>
					<div className="field">
						<label>Placeholder</label>
						<input
							value={item.placeholder ?? ''}
							onChange={(e) => onChange({ placeholder: e.target.value })}
							placeholder="e.g. 90 (seconds)"
						/>
					</div>
					{item.inputType === 'number' && (
						<div className="field">
							<label>Min / Max / Step (optional)</label>
							<div className="row">
								<input
									type="number"
									value={item.min ?? ''}
									onChange={(e) => onChange({ min: e.target.value === '' ? undefined : +e.target.value })}
								/>
								<input
									type="number"
									value={item.max ?? ''}
									onChange={(e) => onChange({ max: e.target.value === '' ? undefined : +e.target.value })}
								/>
								<input
									type="number"
									value={item.step ?? ''}
									onChange={(e) => onChange({ step: e.target.value === '' ? undefined : +e.target.value })}
								/>
							</div>
						</div>
					)}
				</>
			)
		case 'group':
			return (
				<>
					<div className="field">
						<label>Title (shown along top edge)</label>
						<input
							value={item.title}
							onChange={(e) => onChange({ title: e.target.value })}
							placeholder="e.g. Audio, Lighting"
							data-testid="field-title"
						/>
					</div>
					<div className="field">
						<label>Variant</label>
						<select
							value={item.variant}
							onChange={(e) => onChange({ variant: e.target.value as any })}
							data-testid="field-variant"
						>
							<option value="solid">Solid card</option>
							<option value="glass">Glass (blurred)</option>
							<option value="ghost">Ghost (outline only)</option>
						</select>
					</div>
				</>
			)
	}
}

function StyleFields(props: { item: PanelItem; onChange: (patch: Partial<PanelItem>) => void }) {
	const { item, onChange } = props
	const style = item.style
	function setStyle(patch: Partial<typeof style>) {
		onChange({ style: { ...style, ...patch } })
	}
	return (
		<>
			<div className="field">
				<label>Label</label>
				<input value={style.label ?? ''} onChange={(e) => setStyle({ label: e.target.value || undefined })} />
			</div>
			<div className="field">
				<label>Background / Foreground</label>
				<div className="row">
					<input
						type="text"
						value={style.bg ?? ''}
						onChange={(e) => setStyle({ bg: e.target.value || undefined })}
						placeholder="theme"
					/>
					<input
						type="text"
						value={style.fg ?? ''}
						onChange={(e) => setStyle({ fg: e.target.value || undefined })}
						placeholder="theme"
					/>
				</div>
				<div style={{ fontSize: 10, color: 'var(--cmp-muted)' }}>Leave blank to use the active theme</div>
			</div>
			<div className="field">
				<label>Font size</label>
				<input
					type="number"
					value={style.fontSize ?? ''}
					onChange={(e) => setStyle({ fontSize: +e.target.value || undefined })}
				/>
			</div>
		</>
	)
}

function parseAuto(s: string): string | number | boolean {
	if (s === 'true') return true
	if (s === 'false') return false
	if (s === '') return ''
	if (!Number.isNaN(Number(s))) return Number(s)
	return s
}
