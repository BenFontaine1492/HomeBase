import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/settings.repository', () => ({ findAll: vi.fn(), write: vi.fn(), writeAll: vi.fn() }))

import * as repository from '@/repositories/settings.repository'
import { loadSettings, saveGeneralSettings, setMaintenanceDueSoonDays } from '@/services/settings.service'
import { DEFAULT_SETTINGS, SettingValue } from '@/types/settings'

describe('settings service', () => {
  it('reads the stored settings', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([{ key: 'maintenance.due_soon_days', value: '14' }])
    await expect(loadSettings()).resolves.toEqual({ ...DEFAULT_SETTINGS, maintenanceDueSoonDays: 14 })
  })

  it('saves a validated value', async () => {
    vi.mocked(repository.write).mockResolvedValue()
    await setMaintenanceDueSoonDays(14)
    const setting = vi.mocked(repository.write).mock.calls[0]?.[0]
    expect(setting).toBeInstanceOf(SettingValue)
    expect(setting).toMatchObject({ value: '14' })
    await expect(setMaintenanceDueSoonDays(0)).rejects.toThrow('Enter a whole number of days from 1 to 365.')
  })

  it('saves the general settings together', async () => {
    vi.mocked(repository.writeAll).mockResolvedValue()
    await saveGeneralSettings({ language: 'de', formatLocale: null, currency: 'EUR', theme: 'light' })
    const settings = vi.mocked(repository.writeAll).mock.calls[0]?.[0] ?? []
    expect(settings).toHaveLength(4)
    expect(settings.every((setting) => setting instanceof SettingValue)).toBe(true)
  })
})
