/*
 * App settings, stored as key/value text pairs in the `settings` table (migration 0006).
 * A key that isn't stored means "use the default", so new settings need no migration.
 * Settings → Data's export and import include them like any other table.
 */

/** Keys in the `settings` table. */
export const SETTING_KEYS = {
  maintenanceDueSoonDays: 'maintenance.due_soon_days',
} as const

export interface AppSettings {
  /**
   * Days before its due date a maintenance task counts as "due soon".
   * null = the default rule (see `dueSoonWindowDays` in maintenance-schedule.ts).
   */
  maintenanceDueSoonDays: number | null
}

export const DEFAULT_SETTINGS: Readonly<AppSettings> = {
  maintenanceDueSoonDays: null,
}

/** Upper limit of the custom "due soon" window. */
export const MAX_DUE_SOON_DAYS = 365

/** One stored setting (a row of the `settings` table). */
export interface StoredSetting {
  key: string
  value: string
}

function isDueSoonDays(days: number): boolean {
  return Number.isSafeInteger(days) && days >= 1 && days <= MAX_DUE_SOON_DAYS
}

/**
 * The settings from the stored rows. Unknown keys are ignored, and a value that
 * can't be read (e.g. from an edited export) falls back to the default, so a
 * bad value never stops the app from working.
 */
export function settingsFrom(rows: readonly StoredSetting[]): AppSettings {
  const settings: AppSettings = { ...DEFAULT_SETTINGS }
  for (const { key, value } of rows) {
    if (key !== SETTING_KEYS.maintenanceDueSoonDays) continue
    const days = /^\d+$/.test(value) ? Number(value) : Number.NaN
    settings.maintenanceDueSoonDays = isDueSoonDays(days) ? days : null
  }
  return settings
}

/**
 * One setting to save, validated (value object). `value` null = remove the
 * stored value, i.e. go back to the default. Only the static methods can create one.
 */
export class SettingValue {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'SettingValue'

  private constructor(
    readonly key: string,
    readonly value: string | null,
  ) {}

  /** null = the default rule. */
  static maintenanceDueSoonDays(days: number | null): SettingValue {
    if (days !== null && !isDueSoonDays(days)) {
      throw new Error(`Enter a whole number of days from 1 to ${MAX_DUE_SOON_DAYS}.`)
    }
    return new SettingValue(SETTING_KEYS.maintenanceDueSoonDays, days === null ? null : String(days))
  }
}
