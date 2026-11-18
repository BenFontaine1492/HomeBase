import { isLanguage, systemLanguage, t, type FormatPreferences, type Language } from '@/i18n'

/*
 * App settings, stored as key/value text pairs in the `settings` table (migration 0006).
 * A key that isn't stored means "use the default", so new settings need no migration.
 * Settings → Data's export and import include them like any other table.
 */

/** Number/date formats offered in Settings → General (null = the system's). */
export const FORMAT_LOCALES = ['de-DE', 'de-AT', 'de-CH', 'en-GB', 'en-US', 'en-IE'] as const
export type FormatLocale = (typeof FORMAT_LOCALES)[number]

/** Currencies offered in Settings → General (ISO 4217). */
export const CURRENCIES = ['EUR', 'CHF', 'GBP', 'USD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK'] as const
export type Currency = (typeof CURRENCIES)[number]

export const THEMES = ['system', 'light', 'dark'] as const
/** 'system' follows the operating system's light/dark setting. */
export type ThemePreference = (typeof THEMES)[number]

/** Keys in the `settings` table. */
export const SETTING_KEYS = {
  maintenanceDueSoonDays: 'maintenance.due_soon_days',
  language: 'general.language',
  formatLocale: 'general.format_locale',
  currency: 'general.currency',
  theme: 'appearance.theme',
} as const satisfies Record<keyof AppSettings, string>

export interface AppSettings {
  /**
   * Days before its due date a maintenance task counts as "due soon".
   * null = the default rule (see `dueSoonWindowDays` in maintenance-schedule.ts).
   */
  maintenanceDueSoonDays: number | null
  /** null = the system's language (German or English). */
  language: Language | null
  /** Number and date format; null = the system's. */
  formatLocale: FormatLocale | null
  currency: Currency
  theme: ThemePreference
}

export const DEFAULT_SETTINGS: Readonly<AppSettings> = {
  maintenanceDueSoonDays: null,
  language: null,
  formatLocale: null,
  currency: 'EUR',
  theme: 'system',
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

function isFormatLocale(value: string): value is FormatLocale {
  return FORMAT_LOCALES.some((locale) => locale === value)
}

function isCurrency(value: string): value is Currency {
  return CURRENCIES.some((currency) => currency === value)
}

function isTheme(value: string): value is ThemePreference {
  return THEMES.some((theme) => theme === value)
}

/** Reads a stored value; anything unreadable gives the default. */
const PARSERS: { readonly [K in keyof AppSettings]: (value: string) => AppSettings[K] } = {
  maintenanceDueSoonDays: (value) => {
    const days = /^\d+$/.test(value) ? Number(value) : Number.NaN
    return isDueSoonDays(days) ? days : null
  },
  language: (value) => (isLanguage(value) ? value : null),
  formatLocale: (value) => (isFormatLocale(value) ? value : null),
  currency: (value) => (isCurrency(value) ? value : DEFAULT_SETTINGS.currency),
  theme: (value) => (isTheme(value) ? value : DEFAULT_SETTINGS.theme),
}

const FIELDS: readonly (keyof AppSettings)[] = [
  'maintenanceDueSoonDays',
  'language',
  'formatLocale',
  'currency',
  'theme',
]

/**
 * The settings from the stored rows. Unknown keys are ignored, and a value that
 * can't be read (e.g. from an edited export) falls back to the default, so a
 * bad value never stops the app from working.
 */
export function settingsFrom(rows: readonly StoredSetting[]): AppSettings {
  const settings: AppSettings = { ...DEFAULT_SETTINGS }
  for (const { key, value } of rows) {
    const field = FIELDS.find((name) => SETTING_KEYS[name] === key)
    if (field) Object.assign(settings, { [field]: PARSERS[field](value) })
  }
  return settings
}

/** The language, number format and currency the UI uses, given the system's preferred languages. */
export function formatPreferencesOf(settings: AppSettings, systemLanguages: readonly string[]): FormatPreferences {
  return {
    language: settings.language ?? systemLanguage(systemLanguages),
    locale: settings.formatLocale ?? undefined,
    currency: settings.currency,
  }
}

/** The General section of the settings, saved together. */
export interface GeneralSettingsInput {
  language: Language | null
  formatLocale: FormatLocale | null
  currency: Currency
  theme: ThemePreference
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
      throw new Error(t('errors.settings.dueSoonDays', { max: MAX_DUE_SOON_DAYS }))
    }
    return new SettingValue(SETTING_KEYS.maintenanceDueSoonDays, days === null ? null : String(days))
  }

  /** The four settings of Settings → General. Defaults are removed rather than stored. */
  static general(input: GeneralSettingsInput): SettingValue[] {
    if (input.language !== null && !isLanguage(input.language)) throw new Error(t('errors.settings.language'))
    if (input.formatLocale !== null && !isFormatLocale(input.formatLocale)) {
      throw new Error(t('errors.settings.formatLocale'))
    }
    if (!isCurrency(input.currency)) throw new Error(t('errors.settings.currency'))
    if (!isTheme(input.theme)) throw new Error(t('errors.settings.theme'))
    return [
      new SettingValue(SETTING_KEYS.language, input.language),
      new SettingValue(SETTING_KEYS.formatLocale, input.formatLocale),
      new SettingValue(SETTING_KEYS.currency, input.currency === DEFAULT_SETTINGS.currency ? null : input.currency),
      new SettingValue(SETTING_KEYS.theme, input.theme === DEFAULT_SETTINGS.theme ? null : input.theme),
    ]
  }
}
