import { describe, expect, it } from 'vitest'
import { formatAttributeValue } from '@/utils/attribute-value'
import { formatDate } from '@/utils/date'

describe('formatAttributeValue', () => {
  const number = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 10 }).format(value)

  it('formats each type for display', () => {
    expect(formatAttributeValue({ valueType: 'number', value: '12.5', unit: 'kW' })).toBe(`${number(12.5)} kW`)
    expect(formatAttributeValue({ valueType: 'number', value: '1500', unit: null })).toBe(number(1500))
    expect(formatAttributeValue({ valueType: 'boolean', value: '1', unit: null })).toBe('Yes')
    expect(formatAttributeValue({ valueType: 'boolean', value: '0', unit: null })).toBe('No')
    expect(formatAttributeValue({ valueType: 'date', value: '2026-03-04', unit: null })).toBe(formatDate('2026-03-04'))
    expect(formatAttributeValue({ valueType: 'text', value: 'R290', unit: null })).toBe('R290')
  })

  it('returns null for an empty value', () => {
    expect(formatAttributeValue({ valueType: 'number', value: null, unit: 'kW' })).toBeNull()
  })
})
