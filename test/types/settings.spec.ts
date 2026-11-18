import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SETTING_KEYS, SettingValue, settingsFrom } from '@/types/settings'

const key = SETTING_KEYS.maintenanceDueSoonDays

describe('settingsFrom', () => {
  it('uses the defaults for settings that are not stored', () => {
    expect(settingsFrom([])).toEqual(DEFAULT_SETTINGS)
    expect(settingsFrom([{ key: 'unknown.setting', value: '5' }])).toEqual(DEFAULT_SETTINGS)
  })

  it('reads stored values', () => {
    expect(settingsFrom([{ key, value: '60' }])).toEqual({ maintenanceDueSoonDays: 60 })
  })

  it.each(['0', '366', '1.5', '-3', 'soon', ''])('falls back to the default for %j', (value) => {
    expect(settingsFrom([{ key, value }])).toEqual(DEFAULT_SETTINGS)
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
