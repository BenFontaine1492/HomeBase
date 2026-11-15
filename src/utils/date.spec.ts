import { describe, expect, it } from 'vitest'
import { formatDate } from './date'

describe('formatDate', () => {
  it('formats a stored date in the current locale', () => {
    const expected = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(2026, 10, 14))
    expect(formatDate('2026-11-14')).toBe(expected)
  })

  it('returns invalid input unchanged', () => {
    expect(formatDate('not a date')).toBe('not a date')
  })
})
