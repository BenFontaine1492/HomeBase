import { afterEach, describe, expect, it } from 'vitest'
import { setFormatPreferences } from '@/i18n'
import { centsToAmountInput, currencyCode, formatCents, parseAmountToCents } from '@/utils/currency'

afterEach(() => {
  setFormatPreferences({ locale: undefined, currency: 'EUR' })
})

describe('formatCents', () => {
  it('formats whole euros in the current locale', () => {
    // Built the same way as in currency.ts, so the test doesn't depend on the machine's locale.
    const expected = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
    expect(formatCents(1_850_000)).toBe(expected.format(18_500))
  })

  it('uses the chosen format and currency', () => {
    setFormatPreferences({ locale: 'de-DE', currency: 'CHF' })
    expect(currencyCode()).toBe('CHF')
    expect(formatCents(1_850_000).replace(/\s/g, ' ')).toBe('18.500 CHF')
    expect(formatCents(100).replace(/\s/g, ' ')).toBe('1 CHF')
  })
})

describe('centsToAmountInput', () => {
  it('drops the decimals for whole amounts', () => {
    expect(centsToAmountInput(1_850_000)).toBe('18500')
    expect(centsToAmountInput(0)).toBe('0')
  })

  it('keeps two decimals otherwise, with the decimal separator of the format', () => {
    setFormatPreferences({ locale: 'en-GB' })
    expect(centsToAmountInput(1050)).toBe('10.50')
    setFormatPreferences({ locale: 'de-DE' })
    expect(centsToAmountInput(1050)).toBe('10,50')
  })
})

describe('parseAmountToCents', () => {
  it.each([
    ['1250', 125_000],
    ['1.250,50', 125_050],
    ['1,250.50', 125_050],
    ['€ 2 000', 200_000],
    ['10,5', 1050],
    ['10.05', 1005],
    [',50', 50],
    ['1.250.000', 125_000_000],
  ])('parses %s', (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents)
  })

  it.each(['', 'abc', '.,'])('returns null for %j', (input) => {
    expect(parseAmountToCents(input)).toBeNull()
  })

  it('returns null for amounts that are too large', () => {
    expect(parseAmountToCents('9'.repeat(20))).toBeNull()
  })
})
