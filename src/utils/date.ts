const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** True for a real calendar date in 'YYYY-MM-DD' form (rejects e.g. '2023-02-29'). */
export function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Formats a stored 'YYYY-MM-DD' date for display, e.g. "14 Nov 2026". */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return Number.isNaN(date.getTime()) ? isoDate : formatter.format(date)
}
