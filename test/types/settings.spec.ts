import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  SettingValue,
  formatPreferencesOf,
  settingsFrom,
  type GeneralSettingsInput,
} from '@/types/settings'

const key = SETTING_KEYS.maintenanceDueSoonDays

describe('settingsFrom', () => {
  it('uses the defaults for settings that are not stored', () => {
    expect(settingsFrom([])).toEqual(DEFAULT_SETTINGS)
    expect(settingsFrom([{ key: 'unknown.setting', value: '5' }])).toEqual(DEFAULT_SETTINGS)
  })

  it('reads stored values', () => {
    expect(
      settingsFrom([
        { key, value: '60' },
        { key: SETTING_KEYS.language, value: 'de' },
        { key: SETTING_KEYS.formatLocale, value: 'de-AT' },
        { key: SETTING_KEYS.currency, value: 'CHF' },
        { key: SETTING_KEYS.theme, value: 'dark' },
      ]),
    ).toEqual({ maintenanceDueSoonDays: 60, language: 'de', formatLocale: 'de-AT', currency: 'CHF', theme: 'dark' })
  })

  it.each(['0', '366', '1.5', '-3', 'soon', ''])('falls back to the default for %j days', (value) => {
    expect(settingsFrom([{ key, value }])).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to the defaults for unknown general values', () => {
    expect(
      settingsFrom([
        { key: SETTING_KEYS.language, value: 'fr' },
        { key: SETTING_KEYS.formatLocale, value: 'xx-YY' },
        { key: SETTING_KEYS.currency, value: 'DOGE' },
        { key: SETTING_KEYS.theme, value: 'pink' },
      ]),
    ).toEqual(DEFAULT_SETTINGS)
  })
})

describe('formatPreferencesOf', () => {
  it('uses the chosen language and format', () => {
    const settings = { ...DEFAULT_SETTINGS, language: 'de', formatLocale: 'de-CH', currency: 'CHF' } as const
    expect(formatPreferencesOf(settings, ['en-US'])).toEqual({ language: 'de', locale: 'de-CH', currency: 'CHF' })
  })

  it('follows the system language and format by default', () => {
    expect(formatPreferencesOf(DEFAULT_SETTINGS, ['fr-FR', 'de-DE'])).toEqual({
      language: 'de',
      locale: undefined,
      currency: 'EUR',
    })
  })
})

describe('SettingValue.maintenanceDueSoonDays', () => {
  it('stores days as text, null removes the stored value', () => {
    expect({ ...SettingValue.maintenanceDueSoonDays(60) }).toEqual({ key, value: '60' })
    expect({ ...SettingValue.maintenanceDueSoonDays(null) }).toEqual({ key, value: null })
  })

  it.each([0, 366, 2.5])('rejects %d', (days) => {
    expect(() => SettingValue.maintenanceDueSoonDays(days)).toThrow('Enter a whole number of days from 1 to 365.')
  })

  it('can only be created through its static methods (checked by the type check)', () => {
    // @ts-expect-error a plain object is not a SettingValue
    const lookalike: SettingValue = { key, value: '1' }
    expect(lookalike).not.toBeInstanceOf(SettingValue)
  })
})

describe('SettingValue.general', () => {
  const input: GeneralSettingsInput = { language: 'de', formatLocale: 'de-DE', currency: 'CHF', theme: 'dark' }

  it('stores the four general settings', () => {
    expect(SettingValue.general(input).map((setting) => ({ ...setting }))).toEqual([
      { key: SETTING_KEYS.language, value: 'de' },
      { key: SETTING_KEYS.formatLocale, value: 'de-DE' },
      { key: SETTING_KEYS.currency, value: 'CHF' },
      { key: SETTING_KEYS.theme, value: 'dark' },
    ])
  })

  it('removes defaults instead of storing them', () => {
    const defaults = { language: null, formatLocale: null, currency: 'EUR', theme: 'system' } as const
    expect(SettingValue.general(defaults).map(({ value }) => value)).toEqual([null, null, null, null])
  })

  it.each<[Partial<Record<keyof GeneralSettingsInput, string>>, string]>([
    [{ language: 'fr' }, 'Unknown language.'],
    [{ formatLocale: 'xx' }, 'Unknown number and date format.'],
    [{ currency: 'DOGE' }, 'Unknown currency.'],
    [{ theme: 'pink' }, 'Unknown theme.'],
  ])('rejects %j', (change, message) => {
    expect(() => SettingValue.general({ ...input, ...change } as GeneralSettingsInput)).toThrow(message)
  })
})
