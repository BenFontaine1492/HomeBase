import type { ThemeDefinition } from 'vuetify'
import { describe, expect, it } from 'vitest'
import { homeBaseDark, homeBaseLight } from '@/plugins/themes'
import { blend, contrastRatio } from '@/utils/color'

/** The contrast text needs (WCAG 2.2 AA). */
const TEXT = 4.5

const STATUS_COLORS = ['error', 'warning', 'success', 'info'] as const

/** A colour of the theme; fails the test when the theme lacks it. */
function colorsOf(theme: ThemeDefinition): (name: string) => string {
  const colors = theme.colors as Record<string, string | undefined>
  return (name) => {
    const value = colors[name]
    if (value === undefined) throw new Error(`The theme has no colour "${name}".`)
    return value
  }
}

function opacity(theme: ThemeDefinition, name: 'high-emphasis-opacity' | 'medium-emphasis-opacity'): number {
  return Number(theme.variables?.[name])
}

describe.each([
  ['light', homeBaseLight],
  ['dark', homeBaseDark],
])('the %s theme', (_name, theme) => {
  const color = colorsOf(theme)
  /** Vuetify's on-surface for these surfaces: black text on light ones, white on dark ones. */
  const ink = theme.dark ? '#FFFFFF' : '#000000'
  const surfaces = [color('background'), color('layer'), color('surface')]

  it.each(surfaces)('has readable normal and secondary text on %s', (surface) => {
    expect(contrastRatio(blend(ink, opacity(theme, 'high-emphasis-opacity'), surface), surface)).toBeGreaterThan(TEXT)
    expect(contrastRatio(blend(ink, opacity(theme, 'medium-emphasis-opacity'), surface), surface)).toBeGreaterThan(TEXT)
  })

  it.each(surfaces)('has readable accent and status colours on %s', (surface) => {
    for (const name of ['primary', ...STATUS_COLORS]) {
      expect(contrastRatio(color(name), surface), name).toBeGreaterThan(TEXT)
    }
  })

  it('has readable status colours on their own containers (badges, alerts)', () => {
    for (const name of STATUS_COLORS) {
      expect(contrastRatio(color(name), color(`${name}-container`)), name).toBeGreaterThan(TEXT)
      expect(contrastRatio(ink, color(`${name}-container`)), `text on ${name}-container`).toBeGreaterThan(TEXT)
    }
  })

  it('has readable text on the accent, the standard buttons and the neutral badges', () => {
    expect(contrastRatio(color('on-primary'), color('primary'))).toBeGreaterThan(TEXT)
    expect(contrastRatio(color('on-control'), color('control'))).toBeGreaterThan(TEXT)
    expect(contrastRatio(color('on-surface-variant'), color('surface-variant'))).toBeGreaterThan(TEXT)
    expect(contrastRatio(color('on-surface-variant'), color('surface'))).toBeGreaterThan(TEXT)
  })
})
