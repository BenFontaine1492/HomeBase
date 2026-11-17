import { describe, expect, it } from 'vitest'
import { normaliseText } from '@/utils/text'

describe('normaliseText', () => {
  it('trims text and turns empty values into null', () => {
    expect(normaliseText(' Basement ')).toBe('Basement')
    expect(normaliseText('   ')).toBeNull()
    expect(normaliseText(null)).toBeNull()
    expect(normaliseText(undefined)).toBeNull()
  })
})
