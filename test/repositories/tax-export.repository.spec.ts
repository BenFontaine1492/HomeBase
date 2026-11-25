import { describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@/infrastructure/log', () => ({ logError: vi.fn() }))

import { invoke } from '@tauri-apps/api/core'
import * as repository from '@/repositories/tax-export.repository'
import type { TaxExportPlan } from '@/types/tax-export'

describe('exportTaxFolder', () => {
  it('invokes the native command with the folder and the plan', async () => {
    const plan = { folderName: 'F' } as TaxExportPlan
    const result = { folder: 'C:/F', copied: 1, missing: [] }
    vi.mocked(invoke).mockResolvedValue(result)
    await expect(repository.exportTaxFolder('C:/', plan)).resolves.toEqual(result)
    expect(invoke).toHaveBeenCalledWith('export_tax_folder', { directory: 'C:/', plan })
  })
})
