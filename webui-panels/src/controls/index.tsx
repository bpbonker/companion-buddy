import type { CSSProperties } from 'react'
import type { PanelItem } from '@companion-app/shared/Model/PanelModel.js'
import { ButtonControl } from './ButtonControl'
import { GroupControl } from './GroupControl'
import { ImageControl } from './ImageControl'
import { IndicatorControl } from './IndicatorControl'
import { InputControl } from './InputControl'
import { KnobControl } from './KnobControl'
import { LabelControl } from './LabelControl'
import { MeterControl } from './MeterControl'
import { SliderControl } from './SliderControl'

export type ControlMode = 'design' | 'runtime'

export interface ControlRenderProps {
	item: PanelItem
	mode: ControlMode
	value?: unknown
	onWriteVar?: (varName: string, value: unknown) => void
	onPress?: (pressed: boolean) => void
	/** Panel-level PIN used to gate buttons with requirePin=true. Undefined = no PIN set. */
	panelPin?: string
}

export function ControlRenderer(props: ControlRenderProps) {
	const { item } = props
	switch (item.kind) {
		case 'button':
			return <ButtonControl {...props} item={item} />
		case 'slider':
			return <SliderControl {...props} item={item} />
		case 'knob':
			return <KnobControl {...props} item={item} />
		case 'indicator':
			return <IndicatorControl {...props} item={item} />
		case 'meter':
			return <MeterControl {...props} item={item} />
		case 'label':
			return <LabelControl {...props} item={item} />
		case 'image':
			return <ImageControl {...props} item={item} />
		case 'input':
			return <InputControl {...props} item={item} />
		case 'group':
			return <GroupControl {...props} item={item} />
	}
}

export function baseItemStyle(item: PanelItem, cellPx: number): CSSProperties {
	return {
		left: item.x * cellPx,
		top: item.y * cellPx,
		width: item.w * cellPx,
		height: item.h * cellPx,
	}
}

export function asNumber(v: unknown, fallback = 0): number {
	if (typeof v === 'number' && Number.isFinite(v)) return v
	if (typeof v === 'string') {
		const n = Number(v)
		if (Number.isFinite(n)) return n
	}
	if (typeof v === 'boolean') return v ? 1 : 0
	return fallback
}

export function asBool(v: unknown, truthy?: string): boolean {
	if (truthy !== undefined && truthy !== '') {
		try {
			const compiled = new Function('v', `return (v ${truthy})`) as (v: unknown) => boolean
			return !!compiled(asNumber(v))
		} catch {
			return false
		}
	}
	if (typeof v === 'boolean') return v
	if (typeof v === 'number') return v !== 0
	if (typeof v === 'string') return v !== '' && v !== '0' && v.toLowerCase() !== 'false'
	return !!v
}

export function asText(v: unknown): string {
	if (v === undefined || v === null) return ''
	if (typeof v === 'string') return v
	return String(v)
}
