import { formatPreferences } from '@/i18n'

/*
 * Number formats for workbooks (the export for a tax advisor), from Settings →
 * General. Excel shows the separators of the reader's own system; only the order
 * of the date parts and the currency symbol come from here.
 */

/** A literal in an Excel number format: "…" with inner quotes dropped. */
function literal(text: string): string {
  return `"${text.replaceAll('"', '')}"`
}

/** The amount format of the current currency, e.g. `#,##0.00 "€"` or `"$"#,##0.00`. */
export function excelCurrencyFormat(): string {
  const parts = new Intl.NumberFormat(formatPreferences.locale, {
    style: 'currency',
    currency: formatPreferences.currency,
  }).formatToParts(1)
  const symbolIndex = parts.findIndex((part) => part.type === 'currency')
  const symbol = literal(
    parts
      .filter((part) => part.type === 'currency')
      .map((part) => part.value)
      .join(''),
  )
  const numberIndex = parts.findIndex((part) => part.type === 'integer')
  return symbolIndex < numberIndex ? `${symbol}#,##0.00` : `#,##0.00 ${symbol}`
}

const DATE_CODES: Readonly<Partial<Record<Intl.DateTimeFormatPartTypes, string>>> = {
  day: 'dd',
  month: 'mm',
  year: 'yyyy',
}

/** The date format of the current number and date format, e.g. `dd.mm.yyyy` or `mm/dd/yyyy`. */
export function excelDateFormat(): string {
  const parts = new Intl.DateTimeFormat(formatPreferences.locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(2026, 0, 31))
  return parts.map((part) => DATE_CODES[part.type] ?? literal(part.value)).join('')
}
