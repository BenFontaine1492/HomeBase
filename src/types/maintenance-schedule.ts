import { t } from '@/i18n'
import { addToIsoDate, daysBetween } from '@/utils/date'
import type { HouseholdObject } from './household-object'
import type { MaintenanceRecord } from './maintenance-record'
import type { Interval, MaintenanceTask } from './maintenance-task'

/*
 * When maintenance is due. Calculated from the task, its records and the object,
 * never stored, so it can't go stale. Pure functions: "today" is a parameter.
 */

/**
 * - `overdue`: the due date has passed.
 * - `due-soon`: due within the "due soon" window (see `dueSoonWindowDays`).
 * - `ok`: due later.
 * - `unknown`: no date to count from (never done, no installation or purchase date).
 * - `paused`: the task is switched off.
 */
export type MaintenanceStatus = 'overdue' | 'due-soon' | 'ok' | 'unknown' | 'paused'

export function maintenanceStatusLabel(status: MaintenanceStatus): string {
  return t(`maintenance.status.${status}`)
}

/** Theme colours (see plugins/vuetify.ts); undefined = neutral. */
export const MAINTENANCE_STATUS_COLORS: Readonly<Record<MaintenanceStatus, string | undefined>> = {
  overdue: 'error',
  'due-soon': 'warning',
  ok: 'success',
  unknown: undefined,
  paused: undefined,
}

/** Most urgent first; used to pick an object's overall status. */
const STATUS_RANK: Readonly<Record<MaintenanceStatus, number>> = {
  overdue: 0,
  'due-soon': 1,
  unknown: 2,
  ok: 3,
  paused: 4,
}

export interface MaintenanceSchedule {
  status: MaintenanceStatus
  /** 'YYYY-MM-DD': the later of the task's own date and its newest record. */
  lastDone: string | null
  /** 'YYYY-MM-DD'; null when unknown or paused. */
  dueDate: string | null
  /** Days from today to the due date, negative when overdue; null without a due date. */
  daysUntilDue: number | null
}

/** The default "due soon" window: this many days at most … */
export const DEFAULT_DUE_SOON_DAYS = 30
/** … and at most this share of the interval, so short intervals don't count as due soon all the time. */
export const DUE_SOON_SHARE = 0.1

const AVERAGE_DAYS: Readonly<Record<Interval['intervalUnit'], number>> = {
  day: 1,
  week: 7,
  month: 365.25 / 12,
  year: 365.25,
}

/** The interval in days (months and years on average). */
export function intervalDays({ intervalValue, intervalUnit }: Interval): number {
  return intervalValue * AVERAGE_DAYS[intervalUnit]
}

/**
 * How many days before its due date a task counts as "due soon".
 * `customDays` (the user's setting) replaces the default rule: 30 days, but at
 * most 10 % of the interval and at least 1 day (yearly 30, monthly 3, weekly 1).
 */
export function dueSoonWindowDays(interval: Interval, customDays: number | null): number {
  if (customDays !== null) return customDays
  return Math.min(DEFAULT_DUE_SOON_DAYS, Math.max(1, Math.round(intervalDays(interval) * DUE_SOON_SHARE)))
}

/** `isoDate` plus one interval (month ends are kept: 31 Jan + 1 month = 28/29 Feb). */
export function addInterval(isoDate: string, { intervalValue, intervalUnit }: Interval): string {
  switch (intervalUnit) {
    case 'day':
      return addToIsoDate(isoDate, { days: intervalValue })
    case 'week':
      return addToIsoDate(isoDate, { days: intervalValue * 7 })
    case 'month':
      return addToIsoDate(isoDate, { months: intervalValue })
    case 'year':
      return addToIsoDate(isoDate, { months: intervalValue * 12 })
  }
}

/** The later of the task's own date and the newest record of the task ('YYYY-MM-DD' compares as text). */
export function effectiveLastDone(task: MaintenanceTask, records: readonly MaintenanceRecord[]): string | null {
  let latest = task.lastDoneDate
  for (const record of records) {
    if (record.taskId === task.id && (latest === null || record.date > latest)) latest = record.date
  }
  return latest
}

/** The object dates a task counts from when it was never done. */
export type ScheduleObject = Pick<HouseholdObject, 'installationDate' | 'purchaseDate'>

/**
 * The schedule of one task. Counts from the last maintenance, else the
 * installation date, else the purchase date.
 */
export function scheduleOf(
  task: MaintenanceTask,
  records: readonly MaintenanceRecord[],
  object: ScheduleObject,
  options: { today: string; dueSoonDays: number | null },
): MaintenanceSchedule {
  const lastDone = effectiveLastDone(task, records)
  if (!task.active) return { status: 'paused', lastDone, dueDate: null, daysUntilDue: null }
  const start = lastDone ?? object.installationDate ?? object.purchaseDate
  if (start === null) return { status: 'unknown', lastDone, dueDate: null, daysUntilDue: null }

  const dueDate = addInterval(start, task)
  const daysUntilDue = daysBetween(options.today, dueDate)
  let status: MaintenanceStatus = 'ok'
  if (daysUntilDue < 0) status = 'overdue'
  else if (daysUntilDue <= dueSoonWindowDays(task, options.dueSoonDays)) status = 'due-soon'
  return { status, lastDone, dueDate, daysUntilDue }
}

/** Sorts schedules most urgent first: by status, then by due date. */
export function compareByUrgency(a: MaintenanceSchedule, b: MaintenanceSchedule): number {
  const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status]
  if (byStatus !== 0) return byStatus
  return (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0)
}

/** The maintenance state of an object (or several), for status chips and the dashboard. */
export interface MaintenanceSummary {
  /** The most urgent status; null = nothing scheduled (no tasks). */
  status: MaintenanceStatus | null
  overdue: number
  dueSoon: number
}

export function summarise(schedules: readonly MaintenanceSchedule[]): MaintenanceSummary {
  let status: MaintenanceStatus | null = null
  for (const schedule of schedules) {
    if (status === null || STATUS_RANK[schedule.status] < STATUS_RANK[status]) status = schedule.status
  }
  return {
    status,
    overdue: schedules.filter((schedule) => schedule.status === 'overdue').length,
    dueSoon: schedules.filter((schedule) => schedule.status === 'due-soon').length,
  }
}

/** Chip text of a summary: "2 overdue", "1 due soon", "OK"; null = no chip. */
export function summaryLabel(summary: MaintenanceSummary): string | null {
  switch (summary.status) {
    case null:
    case 'paused':
      return null
    case 'overdue':
      return t('maintenance.summary.overdue', { count: summary.overdue })
    case 'due-soon':
      return t('maintenance.summary.dueSoon', { count: summary.dueSoon })
    case 'unknown':
    case 'ok':
      return maintenanceStatusLabel(summary.status)
  }
}
