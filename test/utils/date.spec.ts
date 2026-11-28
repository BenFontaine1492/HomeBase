import { afterEach, describe, expect, it } from 'vitest'
import { setFormatPreferences } from '@/i18n'
import {
  addToIsoDate,
  dateOfIso,
  daysBetween,
  monthsBetween,
  formatDate,
  formatDateTime,
  formatMonth,
  formatTimestampDate,
  isoDateOf,
  isValidIsoDate,
  todayIsoDate,
} from '@/utils/date'

afterEach(() => {
  setFormatPreferences({ locale: undefined })
})

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

  it('uses the chosen number and date format', () => {
    setFormatPreferences({ locale: 'de-DE' })
    expect(formatDate('2026-11-14')).toBe('14.11.2026')
    setFormatPreferences({ locale: 'en-US' })
    expect(formatDate('2026-11-14')).toBe('Nov 14, 2026')
  })
})

describe('formatTimestampDate / formatDateTime', () => {
  it('formats a timestamp in the chosen format', () => {
    setFormatPreferences({ locale: 'de-DE' })
    const date = new Date(2026, 10, 14, 9, 30, 5)
    expect(formatTimestampDate(date)).toBe('14.11.2026')
    expect(formatDateTime(date)).toBe('14.11.26, 09:30:05')
  })
})

describe('formatMonth', () => {
  it('formats a month in the current locale', () => {
    const expected = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(
      new Date(2026, 10, 1),
    )
    expect(formatMonth('2026-11')).toBe(expected)
  })

  it('returns invalid input unchanged', () => {
    expect(formatMonth('soon')).toBe('soon')
  })
})

describe('todayIsoDate', () => {
  it('formats the local calendar date', () => {
    expect(todayIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('isoDateOf / dateOfIso', () => {
  it('turns the value of a date picker into its local day and back', () => {
    expect(isoDateOf(new Date(2026, 10, 20, 23, 59))).toBe('2026-11-20')
    expect(dateOfIso('2026-11-20')).toEqual(new Date(2026, 10, 20))
  })

  it('gives null for an empty or invalid date', () => {
    expect(dateOfIso('')).toBeNull()
    expect(dateOfIso('2023-02-29')).toBeNull()
  })
})

describe('daysBetween', () => {
  it.each([
    ['2026-01-01', '2026-01-31', 30],
    ['2026-03-01', '2026-02-01', -28],
    ['2026-03-28', '2026-03-30', 2],
    ['2026-05-05', '2026-05-05', 0],
  ])('%s → %s = %i days', (from, to, expected) => {
    expect(daysBetween(from, to)).toBe(expected)
  })
})

describe('monthsBetween', () => {
  it.each([
    ['2026-11-28', '2026-11-28', 0],
    ['2026-11-28', '2026-12-25', 1],
    ['2026-11-28', '2026-12-28', 1],
    ['2026-11-28', '2026-12-29', 2],
    ['2026-11-28', '2027-09-25', 10],
    ['2026-01-31', '2026-02-28', 1],
  ])('%s → %s = %i months', (from, to, expected) => {
    expect(monthsBetween(from, to)).toBe(expected)
  })
})

describe('addToIsoDate', () => {
  it.each([
    ['2026-01-31', { months: 1 }, '2026-02-28'],
    ['2024-01-31', { months: 1 }, '2024-02-29'],
    ['2024-02-29', { months: 12 }, '2025-02-28'],
    ['2026-11-15', { months: 3 }, '2027-02-15'],
    ['2026-12-30', { days: 5 }, '2027-01-04'],
    ['2026-03-10', { days: 14 }, '2026-03-24'],
    ['2026-03-10', {}, '2026-03-10'],
  ])('%s + %j = %s', (date, amount, expected) => {
    expect(addToIsoDate(date, amount)).toBe(expected)
  })
})
