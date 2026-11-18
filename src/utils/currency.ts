import { formatPreferences } from '@/i18n'

/*
 * Amounts are integer cents in the currency chosen in Settings → General (EUR by
 * default). Changing the currency changes only how amounts are shown; nothing is converted.
 */

/** The currency of all amounts, e.g. 'EUR' (for labels such as "Cost (EUR)"). */
export function currencyCode(): string {
  return formatPreferences.currency
}

const formatters = new Map<string, Intl.NumberFormat>()

/** One formatter per locale + currency; building them is comparatively slow. */
function formatterFor(locale: string | undefined, currency: string): Intl.NumberFormat {
  const key = `${locale ?? ''}|${currency}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 })
    formatters.set(key, formatter)
  }
  return formatter
}

export function formatCents(cents: number): string {
  return formatterFor(formatPreferences.locale, formatPreferences.currency).format(cents / 100)
}

/** The decimal separator of the current number format, e.g. ',' for German. */
function decimalSeparator(): string {
  return new Intl.NumberFormat(formatPreferences.locale).format(1.5).replace(/\d/g, '')
}

/**
 * Converts cents into a plain, editable amount string in the current number
 * format, e.g. 1850000 → "18500", 1050 → "10.50" (or "10,50").
 */
export function centsToAmountInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', decimalSeparator())
}

/**
 * Parses user input such as "1250", "1.250,50", "1,250.50" or "€ 2 000" into cents.
 * A trailing separator followed by one or two digits is treated as the decimal
 * separator; every other separator is treated as a thousands separator.
 * Returns null for anything that is not a valid non-negative amount.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d.,]/g, '')
  if (!/\d/.test(cleaned)) return null

  // The separator before the last one or two digits, e.g. ",50" in "1.250,50".
  const decimal = /[.,]\d{1,2}$/.exec(cleaned)
  const wholePart = (decimal ? cleaned.slice(0, decimal.index) : cleaned).replace(/[.,]/g, '')
  const fractionPart = decimal ? decimal[0].slice(1).padEnd(2, '0') : '00'

  const cents = Number(wholePart || '0') * 100 + Number(fractionPart)
  return Number.isSafeInteger(cents) ? cents : null
}
