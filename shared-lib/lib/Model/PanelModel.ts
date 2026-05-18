import { z } from 'zod'

export const PanelGridSchema = z.object({
	cols: z.number().int().positive().default(40),
	rows: z.number().int().positive().default(24),
	cellPx: z.number().int().positive().default(24),
	bg: z.string().optional(),
})
export type PanelGrid = z.infer<typeof PanelGridSchema>

export const PanelItemStyleSchema = z.object({
	label: z.string().optional(),
	bg: z.string().optional(),
	fg: z.string().optional(),
	border: z.string().optional(),
	radius: z.number().optional(),
	fontSize: z.number().optional(),
	icon: z.string().optional(),
})
export type PanelItemStyle = z.infer<typeof PanelItemStyleSchema>

const PositionFields = {
	x: z.number(),
	y: z.number(),
	w: z.number().positive(),
	h: z.number().positive(),
}

const ButtonItem = z.object({
	kind: z.literal('button'),
	id: z.string(),
	...PositionFields,
	mode: z.enum(['momentary', 'toggle', 'press']).default('press'),
	style: PanelItemStyleSchema.default({}),
	writeVar: z.string().optional(),
	writeValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
	writeValueReleased: z.union([z.string(), z.number(), z.boolean()]).optional(),
	stateVar: z.string().optional(),
	/** When true, the kiosk requires the panel-level PIN before this button fires. */
	requirePin: z.boolean().default(false),
	/** When set, pressing this button navigates the kiosk to another panel by slug
	 * (instead of writing a variable). The current token must be instance-wide. */
	navigateTo: z.string().optional(),
})
export type PanelButtonItem = z.infer<typeof ButtonItem>

const SliderItem = z.object({
	kind: z.literal('slider'),
	id: z.string(),
	...PositionFields,
	orientation: z.enum(['horizontal', 'vertical']).default('horizontal'),
	min: z.number().default(0),
	max: z.number().default(100),
	step: z.number().default(1),
	bindVar: z.string(),
	sendRateMs: z.number().int().positive().default(50),
	style: PanelItemStyleSchema.default({}),
})
export type PanelSliderItem = z.infer<typeof SliderItem>

const KnobItem = z.object({
	kind: z.literal('knob'),
	id: z.string(),
	...PositionFields,
	min: z.number().default(0),
	max: z.number().default(100),
	step: z.number().default(1),
	bindVar: z.string(),
	sendRateMs: z.number().int().positive().default(50),
	style: PanelItemStyleSchema.default({}),
})
export type PanelKnobItem = z.infer<typeof KnobItem>

const IndicatorItem = z.object({
	kind: z.literal('indicator'),
	id: z.string(),
	...PositionFields,
	bindVar: z.string(),
	truthy: z.string().optional(),
	colorOn: z.string().default('#22c55e'),
	colorOff: z.string().default('#3f3f46'),
	style: PanelItemStyleSchema.default({}),
})
export type PanelIndicatorItem = z.infer<typeof IndicatorItem>

const MeterItem = z.object({
	kind: z.literal('meter'),
	id: z.string(),
	...PositionFields,
	bindVar: z.string(),
	min: z.number().default(0),
	max: z.number().default(100),
	orientation: z.enum(['horizontal', 'vertical']).default('horizontal'),
	colorFill: z.string().default('#22c55e'),
	style: PanelItemStyleSchema.default({}),
})
export type PanelMeterItem = z.infer<typeof MeterItem>

const LabelItem = z.object({
	kind: z.literal('label'),
	id: z.string(),
	...PositionFields,
	text: z.string().default(''),
	bindVar: z.string().optional(),
	style: PanelItemStyleSchema.default({}),
})
export type PanelLabelItem = z.infer<typeof LabelItem>

const ImageItem = z.object({
	kind: z.literal('image'),
	id: z.string(),
	...PositionFields,
	src: z.string(),
	fit: z.enum(['contain', 'cover', 'fill']).default('contain'),
	style: PanelItemStyleSchema.default({}),
})
export type PanelImageItem = z.infer<typeof ImageItem>

const InputItem = z.object({
	kind: z.literal('input'),
	id: z.string(),
	...PositionFields,
	/** Custom variable to write into (commit on Enter / blur). */
	bindVar: z.string(),
	inputType: z.enum(['text', 'number']).default('number'),
	placeholder: z.string().default(''),
	/** Optional clamp for numeric inputs. */
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().optional(),
	style: PanelItemStyleSchema.default({}),
})
export type PanelInputItem = z.infer<typeof InputItem>

const GroupItem = z.object({
	kind: z.literal('group'),
	id: z.string(),
	...PositionFields,
	title: z.string().default(''),
	/** Visual variant — solid is a flat card, glass adds backdrop blur, ghost is just an outline */
	variant: z.enum(['solid', 'glass', 'ghost']).default('solid'),
	style: PanelItemStyleSchema.default({}),
})
export type PanelGroupItem = z.infer<typeof GroupItem>

export const PanelItemSchema = z.discriminatedUnion('kind', [
	ButtonItem,
	SliderItem,
	KnobItem,
	IndicatorItem,
	MeterItem,
	LabelItem,
	ImageItem,
	InputItem,
	GroupItem,
])
export type PanelItem = z.infer<typeof PanelItemSchema>
export type PanelItemKind = PanelItem['kind']

export const PanelThemeIdSchema = z.enum(['studio-dark', 'boardroom-light', 'companion-red', 'mission-control'])
export type PanelThemeId = z.infer<typeof PanelThemeIdSchema>

export const PanelSchema = z.object({
	id: z.string(),
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9][a-z0-9-]*$/, 'slug must be lowercase alphanumerics + hyphens, starting with alphanumeric'),
	name: z.string().min(1),
	grid: PanelGridSchema,
	theme: PanelThemeIdSchema.default('studio-dark'),
	/** Optional CSS color (hex or rgb) that overrides the theme's primary accent (fill + pressed button) */
	accentColor: z.string().optional(),
	/** Optional CSS color override for the panel canvas background */
	bgColor: z.string().optional(),
	/** Subtle outer bezel around the kiosk canvas, mimicking a hardware faceplate */
	frame: z.boolean().default(false),
	/** Optional PIN that gates buttons with requirePin=true. Plain-text on purpose — this is
	 * a "prevent accidental press" gate for kiosks, not a security boundary against attackers. */
	pin: z.string().optional(),
	items: z.array(PanelItemSchema).default([]),
	createdAt: z.number().int(),
	updatedAt: z.number().int(),
})
export type Panel = z.infer<typeof PanelSchema>

export const PanelTokenSchema = z.object({
	token: z.string(),
	/** When set, the token is scoped to this panel. When omitted, the token is instance-wide
	 * and works for any panel on this Companion server — enables a button to switch the kiosk
	 * between panels without re-pairing. */
	panelId: z.string().optional(),
	label: z.string().default(''),
	createdAt: z.number().int(),
	lastSeenAt: z.number().int().optional(),
	lastUserAgent: z.string().optional(),
})
export type PanelToken = z.infer<typeof PanelTokenSchema>

export const PanelDeviceSummarySchema = z.object({
	token: z.string(),
	label: z.string(),
	createdAt: z.number().int(),
	lastSeenAt: z.number().int().optional(),
	lastUserAgent: z.string().optional(),
})
export type PanelDeviceSummary = z.infer<typeof PanelDeviceSummarySchema>

export const PanelSummarySchema = z.object({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
	itemCount: z.number().int(),
	tokenCount: z.number().int(),
	updatedAt: z.number().int(),
})
export type PanelSummary = z.infer<typeof PanelSummarySchema>

export const NewPanelInputSchema = z.object({
	slug: PanelSchema.shape.slug,
	name: z.string().min(1),
	grid: PanelGridSchema.partial().optional(),
})
export type NewPanelInput = z.infer<typeof NewPanelInputSchema>

export const UpdatePanelInputSchema = z.object({
	id: z.string(),
	name: z.string().min(1).optional(),
	slug: PanelSchema.shape.slug.optional(),
	grid: PanelGridSchema.optional(),
	theme: PanelThemeIdSchema.optional(),
	accentColor: z.string().nullable().optional(),
	bgColor: z.string().nullable().optional(),
	frame: z.boolean().optional(),
	pin: z.string().nullable().optional(),
	items: z.array(PanelItemSchema).optional(),
})
export type UpdatePanelInput = z.infer<typeof UpdatePanelInputSchema>

export type PanelRuntimeServerMsg =
	| { type: 'hello'; panel: Panel; snapshot: Record<string, unknown> }
	| { type: 'panel'; panel: Panel; snapshot: Record<string, unknown> }
	| { type: 'var'; name: string; value: unknown }
	| { type: 'error'; message: string }
	| { type: 'ack'; itemId: string }
	| { type: 'pong' }

export type PanelRuntimeClientMsg =
	| { type: 'writeVar'; itemId: string; varName: string; value: unknown }
	| { type: 'press'; itemId: string; pressed: boolean }
	| { type: 'ping' }
