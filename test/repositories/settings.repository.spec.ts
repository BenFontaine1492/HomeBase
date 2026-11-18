import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn(), transaction: vi.fn() }))

import { execute, select, transaction } from '@/infrastructure/database'
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

  it('writes several settings in one transaction', async () => {
    vi.mocked(transaction).mockResolvedValue([])
    await repository.writeAll(
      SettingValue.general({ language: 'de', formatLocale: null, currency: 'EUR', theme: 'dark' }),
    )
    const statements = vi.mocked(transaction).mock.calls[0]?.[0] ?? []
    expect(statements.map(({ params }) => params)).toEqual([
      ['general.language', 'de'],
      ['general.format_locale'],
      ['general.currency'],
      ['appearance.theme', 'dark'],
    ])
    expect(statements[1]?.sql).toBe('DELETE FROM settings WHERE key = $1')
    expect(statements[0]?.sql).toContain('ON CONFLICT (key) DO UPDATE')
  })
})
