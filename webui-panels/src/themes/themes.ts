import type { PanelThemeId } from '@companion-app/shared/Model/PanelModel.js'

/**
 * Modern dashboard aesthetic (ref: Twisty / Analytics dashboard designs).
 *
 * Design principles encoded by these tokens:
 *   • Flat surfaces — no chrome gradients, no inset glows, no heavy multi-layer shadows
 *   • Generous radius — pill / large-radius cards, fully rounded for thumbs and meters
 *   • Big bold display type for values; tiny uppercase labels for categories
 *   • Accent used as a single bold moment per control (the fill, the pressed state, the dot)
 */
export interface PanelThemeTokens {
	id: PanelThemeId
	label: string
	description: string
	// Canvas
	canvasBg: string
	canvasGrid: string
	// Surfaces (button rest / card / track)
	surfaceBg: string
	surfaceMutedBg: string
	surfaceBorder: string
	// Buttons
	buttonBg: string
	buttonBgPressed: string
	buttonFg: string
	buttonFgPressed: string
	buttonBorder: string
	buttonShadow: string
	buttonRadius: string
	// Sliders / knobs
	trackBg: string
	trackInsetShadow: string
	fillStart: string
	fillEnd: string
	thumbBg: string
	thumbShadow: string
	tickColor: string
	// Indicators / meters / labels
	indicatorOn: string
	indicatorOff: string
	indicatorGlow: string
	meterGradient: string
	labelFg: string
	mutedFg: string
	// Image / group frame
	frameBorder: string
}

const ONYX: PanelThemeTokens = {
	id: 'studio-dark',
	label: 'Onyx',
	description: 'Deep matte black with a single bold accent — Tesla/Apple dark mode',
	canvasBg: '#08080a',
	canvasGrid: 'rgba(255, 255, 255, 0.04)',
	surfaceBg: '#1a1a1f',
	surfaceMutedBg: '#26262c',
	surfaceBorder: '1px solid rgba(255,255,255,0.08)',
	buttonBg: '#2a2a31',
	buttonBgPressed: '#0a84ff',
	buttonFg: '#f5f5f7',
	buttonFgPressed: '#ffffff',
	buttonBorder: '1px solid rgba(255,255,255,0.06)',
	buttonShadow: 'none',
	buttonRadius: '14px',
	trackBg: '#2a2a31',
	trackInsetShadow: 'none',
	fillStart: '#0a84ff',
	fillEnd: '#0a84ff',
	thumbBg: '#ffffff',
	thumbShadow: '0 2px 8px rgba(0,0,0,0.5)',
	tickColor: 'rgba(255,255,255,0.10)',
	indicatorOn: '#30d158',
	indicatorOff: '#2a2a2e',
	indicatorGlow: 'rgba(48,209,88,0.0)',
	meterGradient: '#0a84ff',
	labelFg: '#f5f5f7',
	mutedFg: '#86868b',
	frameBorder: '1px solid rgba(255,255,255,0.06)',
}

const PORCELAIN: PanelThemeTokens = {
	id: 'boardroom-light',
	label: 'Porcelain',
	description: 'Soft cream canvas, pure-white cards — Twisty/finance dashboard look',
	canvasBg: '#eef0f3',
	canvasGrid: 'rgba(15, 23, 42, 0.05)',
	surfaceBg: '#ffffff',
	surfaceMutedBg: '#f3f4f7',
	surfaceBorder: '1px solid rgba(15,23,42,0.08)',
	buttonBg: '#f5f6f8',
	buttonBgPressed: '#0f172a',
	buttonFg: '#0f172a',
	buttonFgPressed: '#ffffff',
	buttonBorder: '1px solid rgba(15,23,42,0.08)',
	buttonShadow: 'none',
	buttonRadius: '14px',
	trackBg: '#e5e7eb',
	trackInsetShadow: 'none',
	fillStart: '#0f172a',
	fillEnd: '#0f172a',
	thumbBg: '#0f172a',
	thumbShadow: '0 2px 6px rgba(15,23,42,0.18)',
	tickColor: 'rgba(15,23,42,0.12)',
	indicatorOn: '#16a34a',
	indicatorOff: '#e5e7eb',
	indicatorGlow: 'rgba(22,163,74,0.0)',
	meterGradient: '#0f172a',
	labelFg: '#0f172a',
	mutedFg: '#6b7280',
	frameBorder: '1px solid rgba(15,23,42,0.08)',
}

const COMPANION_RED: PanelThemeTokens = {
	id: 'companion-red',
	label: 'Companion Red',
	description: 'Companion brand: dark charcoal with the signature red accent',
	canvasBg: '#131316',
	canvasGrid: 'rgba(255, 255, 255, 0.05)',
	surfaceBg: '#1f1f23',
	surfaceMutedBg: '#33333a',
	surfaceBorder: '1px solid rgba(255,255,255,0.08)',
	buttonBg: '#33333a',
	buttonBgPressed: '#d50215',
	buttonFg: '#f5f5f7',
	buttonFgPressed: '#ffffff',
	buttonBorder: '1px solid rgba(255,255,255,0.06)',
	buttonShadow: 'none',
	buttonRadius: '12px',
	trackBg: '#33333a',
	trackInsetShadow: 'none',
	fillStart: '#d50215',
	fillEnd: '#d50215',
	thumbBg: '#ffffff',
	thumbShadow: '0 2px 8px rgba(0,0,0,0.6)',
	tickColor: 'rgba(255,255,255,0.10)',
	indicatorOn: '#d50215',
	indicatorOff: '#2a2a2e',
	indicatorGlow: 'rgba(213,2,21,0.0)',
	meterGradient: '#d50215',
	labelFg: '#f5f5f7',
	mutedFg: '#a0a0a6',
	frameBorder: '1px solid rgba(255,255,255,0.06)',
}

const MISSION_CONTROL: PanelThemeTokens = {
	id: 'mission-control',
	label: 'Mission Control',
	description: 'High-contrast amber on black — night-ops, low-glare environments',
	canvasBg: '#000000',
	canvasGrid: 'rgba(245, 158, 11, 0.06)',
	surfaceBg: '#0a0805',
	surfaceMutedBg: '#1a140a',
	surfaceBorder: '1px solid rgba(245,158,11,0.30)',
	buttonBg: '#13100a',
	buttonBgPressed: '#f59e0b',
	buttonFg: '#f59e0b',
	buttonFgPressed: '#000000',
	buttonBorder: '1px solid rgba(245,158,11,0.35)',
	buttonShadow: 'none',
	buttonRadius: '4px',
	trackBg: '#13100a',
	trackInsetShadow: 'inset 0 0 0 1px rgba(245,158,11,0.30)',
	fillStart: '#f59e0b',
	fillEnd: '#f59e0b',
	thumbBg: '#f59e0b',
	thumbShadow: '0 0 0 1px #000',
	tickColor: 'rgba(245,158,11,0.35)',
	indicatorOn: '#f59e0b',
	indicatorOff: '#1c1611',
	indicatorGlow: 'rgba(245,158,11,0.0)',
	meterGradient: '#f59e0b',
	labelFg: '#f59e0b',
	mutedFg: '#a16207',
	frameBorder: '1px solid rgba(245,158,11,0.25)',
}

export const PANEL_THEMES: Record<PanelThemeId, PanelThemeTokens> = {
	'studio-dark': ONYX,
	'boardroom-light': PORCELAIN,
	'companion-red': COMPANION_RED,
	'mission-control': MISSION_CONTROL,
}

export const PANEL_THEME_LIST: PanelThemeTokens[] = [ONYX, PORCELAIN, COMPANION_RED, MISSION_CONTROL]

export function getTheme(id: PanelThemeId | undefined): PanelThemeTokens {
	return (id && PANEL_THEMES[id]) || ONYX
}

export interface ThemeOverrides {
	accentColor?: string
	bgColor?: string
}

export function themeCssVars(theme: PanelThemeTokens, overrides?: ThemeOverrides): Record<string, string> {
	const accent = overrides?.accentColor
	const bg = overrides?.bgColor
	const accentSolid = accent ?? theme.fillStart
	const buttonPressed = accent ?? theme.buttonBgPressed
	const indicatorOn = accent ?? theme.indicatorOn

	return {
		'--bp-canvas-bg': bg ?? theme.canvasBg,
		'--bp-canvas-grid': theme.canvasGrid,
		'--bp-surface-bg': theme.surfaceBg,
		'--bp-surface-muted-bg': theme.surfaceMutedBg,
		'--bp-surface-border': theme.surfaceBorder,
		'--bp-btn-bg': theme.buttonBg,
		'--bp-btn-bg-pressed': buttonPressed,
		'--bp-btn-fg': theme.buttonFg,
		'--bp-btn-fg-pressed': theme.buttonFgPressed,
		'--bp-btn-border': theme.buttonBorder,
		'--bp-btn-shadow': theme.buttonShadow,
		'--bp-btn-radius': theme.buttonRadius,
		'--bp-track-bg': theme.trackBg,
		'--bp-track-shadow': theme.trackInsetShadow,
		'--bp-fill-start': accentSolid,
		'--bp-fill-end': accentSolid,
		'--bp-accent': accentSolid,
		'--bp-thumb-bg': theme.thumbBg,
		'--bp-thumb-shadow': theme.thumbShadow,
		'--bp-tick': theme.tickColor,
		'--bp-ind-on': indicatorOn,
		'--bp-ind-off': theme.indicatorOff,
		'--bp-ind-glow': accent ? 'rgba(0,0,0,0)' : theme.indicatorGlow,
		'--bp-meter-gradient': accent ?? theme.meterGradient,
		'--bp-label-fg': theme.labelFg,
		'--bp-muted-fg': theme.mutedFg,
		'--bp-frame-border': theme.frameBorder,
	}
}
