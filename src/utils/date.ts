import { formatPreferences } from '@/i18n'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const formatters = new Map<string, Intl.DateTimeFormat>()

/** A cached date formatter for the current locale (Settings → General). */
function formatterFor(name: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const { locale } = formatPreferences
  const key = `${name}|${locale ?? ''}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options)
    formatters.set(key, formatter)
  }
  return formatter
}

/** True for a real calendar date in 'YYYY-MM-DD' form (rejects e.g. '2023-02-29'). */
export function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Formats a stored 'YYYY-MM-DD' date for display, e.g. "14 Nov 2026". */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return Number.isNaN(date.getTime()) ? isoDate : formatterFor('date', { dateStyle: 'medium' }).format(date)
}

/** Formats a timestamp (e.g. an ISO date-time) as a date, e.g. "14 Nov 2026". */
export function formatTimestampDate(date: Date): string {
  return formatterFor('date', { dateStyle: 'medium' }).format(date)
}

/** Formats a timestamp with date and time, e.g. "14/11/2026, 09:30:00". */
export function formatDateTime(date: Date): string {
  return formatterFor('date-time', { dateStyle: 'short', timeStyle: 'medium' }).format(date)
}

/** Formats a 'YYYY-MM' month for display, e.g. "Nov 2026". */
export function formatMonth(isoMonth: string): string {
  const date = new Date(`${isoMonth}-01T00:00:00`)
  return Number.isNaN(date.getTime())
    ? isoMonth
    : formatterFor('month', { month: 'short', year: 'numeric' }).format(date)
}

const MS_PER_DAY = 86_400_000

/** Two-digit month or day. */
function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** The local calendar date of `now` as 'YYYY-MM-DD' (today by default). */
export function todayIsoDate(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Whole days from `from` to `to` (both 'YYYY-MM-DD'); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY)
}

/**
 * A 'YYYY-MM-DD' date plus calendar `months`, then `days`. Adding months keeps the
 * day of the month, or uses the month's last day: 31 Jan + 1 month = 28/29 Feb.
 */
export function addToIsoDate(isoDate: string, { months = 0, days = 0 }: { months?: number; days?: number }): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  const dayOfMonth = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const lastDayOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(dayOfMonth, lastDayOfMonth) + days)
  return date.toISOString().slice(0, 10)
}
