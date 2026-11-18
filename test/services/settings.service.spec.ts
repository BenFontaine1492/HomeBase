import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/settings.repository', () => ({ findAll: vi.fn(), write: vi.fn() }))

import * as repository from '@/repositories/settings.repository'
import { loadSettings, setMaintenanceDueSoonDays } from '@/services/settings.service'
import { SettingValue } from '@/types/settings'

describe('settings service', () => {
  it('reads the stored settings', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([{ key: 'maintenance.due_soon_days', value: '14' }])
    await expect(loadSettings()).resolves.toEqual({ maintenanceDueSoonDays: 14 })
  })

  it('saves a validated value', async () => {
    vi.mocked(repository.write).mockResolvedValue()
    await setMaintenanceDueSoonDays(14)
    const setting = vi.mocked(repository.write).mock.calls[0]?.[0]
    expect(setting).toBeInstanceOf(SettingValue)
    expect(setting).toMatchObject({ value: '14' })
    await expect(setMaintenanceDueSoonDays(0)).rejects.toThrow('Enter a whole number of days from 1 to 365.')
  })
})
