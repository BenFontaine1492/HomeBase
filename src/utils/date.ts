const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

/** Formats a stored 'YYYY-MM-DD' date for display, e.g. "14 Nov 2026". */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return Number.isNaN(date.getTime()) ? isoDate : formatter.format(date)
}
