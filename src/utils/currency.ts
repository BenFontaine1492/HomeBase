/** Currency used for all amounts. A user setting can replace this later. */
export const CURRENCY = 'EUR'

const formatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
})

export function formatCents(cents: number): string {
  return formatter.format(cents / 100)
}

/** Converts cents into a plain, editable amount string, e.g. 1850000 → "18500", 1050 → "10.50". */
export function centsToAmountInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
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
