import { describe, expect, it } from 'vitest'
import { formatDate, isValidIsoDate } from '@/utils/date'

describe('isValidIsoDate', () => {
  it.each(['2024-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isValidIsoDate(value)).toBe(true)
  })

  it.each(['2023-02-29', '2024-13-01', '2024-1-1', '1.1.2024', ''])('rejects %j', (value) => {
    expect(isValidIsoDate(value)).toBe(false)
  })
})

describe('formatDate', () => {
  it('formats a stored date in the current locale', () => {
    const expected = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(2026, 10, 14))
    expect(formatDate('2026-11-14')).toBe(expected)
  })

  it('returns invalid input unchanged', () => {
    expect(formatDate('not a date')).toBe('not a date')
  })
})
