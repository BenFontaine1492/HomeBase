import { t } from '@/i18n'
import { isValidIsoDate } from '@/utils/date'
import { normaliseText } from '@/utils/text'

/** Units of a maintenance interval. Must match the CHECK in migration 0004. */
export const INTERVAL_UNITS = ['day', 'week', 'month', 'year'] as const

export type IntervalUnit = (typeof INTERVAL_UNITS)[number]

/** Upper limit of `intervalValue` (also a CHECK in migration 0004). */
export const MAX_INTERVAL_VALUE = 3650

/**
 * A recurring maintenance task of a household object, e.g. "Service, every 1 year".
 * When it is due is calculated (see maintenance-schedule.ts), not stored.
 */
export interface MaintenanceTask {
  id: number
  objectId: number
  name: string
  /** Every `intervalValue` `intervalUnit`s, e.g. 1 year or 10 days. */
  intervalValue: number
  intervalUnit: IntervalUnit
  /**
   * 'YYYY-MM-DD', entered by hand: maintenance done before it was recorded in
   * HomeBase. Newer maintenance records of the task take precedence.
   */
  lastDoneDate: string | null
  notes: string | null
  /** false = paused: kept, but not scheduled. */
  active: boolean
  createdAt: string
  updatedAt: string
}

/** User-editable fields of a task, for creating and updating. */
export interface MaintenanceTaskInput {
  name: string
  intervalValue: number
  intervalUnit: IntervalUnit
  lastDoneDate?: string | null
  notes?: string | null
  active: boolean
}

/** The fields of a task, validated and normalised (value object). Only `from()` can create one. */
export class MaintenanceTaskValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'MaintenanceTaskValues'

  readonly name: string
  readonly intervalValue: number
  readonly intervalUnit: IntervalUnit
  /** 'YYYY-MM-DD' */
  readonly lastDoneDate: string | null
  readonly notes: string | null
  readonly active: boolean

  private constructor(fields: Omit<MaintenanceTaskValues, 'brand'>) {
    this.name = fields.name
    this.intervalValue = fields.intervalValue
    this.intervalUnit = fields.intervalUnit
    this.lastDoneDate = fields.lastDoneDate
    this.notes = fields.notes
    this.active = fields.active
  }

  static from(input: MaintenanceTaskInput): MaintenanceTaskValues {
    const name = input.name.trim()
    if (name.length === 0) throw new Error(t('errors.task.nameRequired'))
    const { intervalValue, intervalUnit } = input
    if (!Number.isSafeInteger(intervalValue) || intervalValue < 1 || intervalValue > MAX_INTERVAL_VALUE) {
      throw new Error(t('errors.task.invalidInterval', { max: MAX_INTERVAL_VALUE }))
    }
    if (!INTERVAL_UNITS.includes(intervalUnit)) throw new Error(t('errors.task.unknownUnit'))
    const lastDoneDate = normaliseText(input.lastDoneDate)
    if (lastDoneDate !== null && !isValidIsoDate(lastDoneDate)) {
      throw new Error(t('errors.task.invalidLastDone'))
    }
    return new MaintenanceTaskValues({
      name,
      intervalValue,
      intervalUnit,
      lastDoneDate,
      notes: normaliseText(input.notes),
      active: input.active,
    })
  }
}

/**
 * The interval choices of the task form. A task stores value + unit, so further
 * choices (e.g. "every N months") need no migration.
 */
export const INTERVAL_PRESETS = ['yearly', 'monthly', 'weekly', 'custom'] as const

export type IntervalPreset = (typeof INTERVAL_PRESETS)[number]

export function intervalPresetLabel(preset: IntervalPreset): string {
  return t(`maintenance.intervalPresets.${preset}`)
}

export interface Interval {
  intervalValue: number
  intervalUnit: IntervalUnit
}

/** The interval of a form choice; `customDays` is used for 'custom' only. */
export function intervalOf(preset: IntervalPreset, customDays: number): Interval {
  switch (preset) {
    case 'yearly':
      return { intervalValue: 1, intervalUnit: 'year' }
    case 'monthly':
      return { intervalValue: 1, intervalUnit: 'month' }
    case 'weekly':
      return { intervalValue: 1, intervalUnit: 'week' }
    case 'custom':
      return { intervalValue: customDays, intervalUnit: 'day' }
  }
}

/** The form choice of a stored interval; null if the form can't show it (e.g. every 3 months). */
export function presetOf({ intervalValue, intervalUnit }: Interval): IntervalPreset | null {
  if (intervalUnit === 'day') return 'custom'
  if (intervalValue !== 1) return null
  switch (intervalUnit) {
    case 'year':
      return 'yearly'
    case 'month':
      return 'monthly'
    case 'week':
      return 'weekly'
  }
}

/** "Yearly", "Every 10 days", "Every 3 months". */
export function intervalLabel({ intervalValue, intervalUnit }: Interval): string {
  if (intervalValue === 1) return t(`maintenance.intervals.single.${intervalUnit}`)
  return t(`maintenance.intervals.every.${intervalUnit}`, { count: intervalValue })
}
