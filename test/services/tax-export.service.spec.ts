import { describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@/repositories/tax-export.repository', () => ({ exportTaxFolder: vi.fn() }))

import { open } from '@tauri-apps/plugin-dialog'
import * as repository from '@/repositories/tax-export.repository'
import * as service from '@/services/tax-export.service'
import type { TaxExportPlan } from '@/types/tax-export'

describe('tax export', () => {
  it('lets the user pick a folder', async () => {
    vi.mocked(open).mockResolvedValue('C:/Steuer')
    await expect(service.pickExportFolder()).resolves.toBe('C:/Steuer')
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ directory: true, multiple: false }))
    vi.mocked(open).mockResolvedValue(null)
    await expect(service.pickExportFolder()).resolves.toBeNull()
  })

  it('passes the plan to the native command', async () => {
    const plan = { folderName: 'F' } as TaxExportPlan
    vi.mocked(repository.exportTaxFolder).mockResolvedValue({ folder: 'C:/F', copied: 0, missing: [] })
    await expect(service.exportTaxFolder('C:/', plan)).resolves.toMatchObject({ folder: 'C:/F' })
    expect(repository.exportTaxFolder).toHaveBeenCalledWith('C:/', plan)
  })
})
