import { afterEach, describe, expect, it } from 'vitest'
import { setFormatPreferences } from '@/i18n'
import { excelCurrencyFormat, excelDateFormat } from '@/utils/excel-format'

afterEach(() => {
  setFormatPreferences({ locale: undefined, currency: 'EUR' })
})

describe('excelCurrencyFormat', () => {
  it('puts the symbol where the number format does', () => {
    setFormatPreferences({ locale: 'de-DE', currency: 'EUR' })
    expect(excelCurrencyFormat()).toBe('#,##0.00 "€"')
    setFormatPreferences({ locale: 'en-US', currency: 'USD' })
    expect(excelCurrencyFormat()).toBe('"$"#,##0.00')
  })
})

describe('excelDateFormat', () => {
  it('follows the order of the date parts', () => {
    setFormatPreferences({ locale: 'de-DE' })
    expect(excelDateFormat()).toBe('dd"."mm"."yyyy')
    setFormatPreferences({ locale: 'en-US' })
    expect(excelDateFormat()).toBe('mm"/"dd"/"yyyy')
  })
})
