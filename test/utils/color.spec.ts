import { describe, expect, it } from 'vitest'
import { blend, contrastRatio, withOpacity } from '@/utils/color'

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for the same colour, in either order', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#5B47E0', '#5B47E0')).toBe(1)
  })

  it('matches known values', () => {
    expect(contrastRatio('#F59E0B', '#FFFFFF')).toBeCloseTo(2.15, 2)
    expect(contrastRatio('#C42B1C', '#FFFFFF')).toBeCloseTo(5.66, 2)
    expect(contrastRatio('#020202', '#FFFFFF')).toBeGreaterThan(20)
  })
})

describe('blend', () => {
  it('mixes a colour into the background', () => {
    expect(blend('#000000', 0.62, '#FFFFFF')).toBe('#616161')
    expect(blend('#000000', 1, '#FFFFFF')).toBe('#000000')
    expect(blend('#FFFFFF', 0, '#2D2D2D')).toBe('#2D2D2D')
  })
})

describe('withOpacity', () => {
  it('turns 3- and 6-digit hex colours into rgba()', () => {
    expect(withOpacity('#fff', 0.12)).toBe('rgba(255, 255, 255, 0.12)')
    expect(withOpacity('#5B47E0', 0.5)).toBe('rgba(91, 71, 224, 0.5)')
  })
})
