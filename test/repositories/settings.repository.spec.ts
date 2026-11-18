import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn() }))

import { execute, select } from '@/infrastructure/database'
import * as repository from '@/repositories/settings.repository'
import { SettingValue } from '@/types/settings'

describe('settings repository', () => {
  it('reads all stored settings', async () => {
    vi.mocked(select).mockResolvedValue([{ key: 'maintenance.due_soon_days', value: '60' }])
    await expect(repository.findAll()).resolves.toEqual([{ key: 'maintenance.due_soon_days', value: '60' }])
  })

  it('inserts or replaces a value', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await repository.write(SettingValue.maintenanceDueSoonDays(60))
    const [sql, params] = vi.mocked(execute).mock.calls[0] ?? []
    expect(sql).toContain('ON CONFLICT (key) DO UPDATE')
    expect(params).toEqual(['maintenance.due_soon_days', '60'])
  })

  it('removes the value to go back to the default', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await repository.write(SettingValue.maintenanceDueSoonDays(null))
    expect(execute).toHaveBeenCalledWith('DELETE FROM settings WHERE key = $1', ['maintenance.due_soon_days'])
  })
})
