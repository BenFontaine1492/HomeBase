import { describe, expect, it, vi } from 'vitest'
import type { Cost } from '@/types/cost'
import type { TaxExportPlan } from '@/types/tax-export'

const service = vi.hoisted(() => ({ pickExportFolder: vi.fn(), exportTaxFolder: vi.fn() }))
vi.mock('@/services/tax-export.service', () => service)

function cost(id: number, objectId: number | null): Cost {
  return {
    id,
    paidDate: '2026-03-01',
    amountCents: 100,
    labourCents: null,
    costType: 'repair',
    description: `#${id}`,
    payee: null,
    paymentMethod: null,
    notes: null,
    taxCategoryId: 1,
    householdObjectId: objectId,
    maintenanceRecordId: null,
    investmentId: null,
    recurringCostId: null,
    objectId,
    createdAt: '',
    updatedAt: '',
  }
}

const state = vi.hoisted(() => ({
  ensureCosts: vi.fn(),
  ensureAttachments: vi.fn(),
  ensureObjects: vi.fn(),
  findObject: vi.fn(),
}))
vi.mock('@/composables/useCosts', () => ({
  useCosts: () => ({
    costs: { value: [cost(1, null), cost(2, 7), cost(3, 8)] },
    titleOf: (c: Cost) => c.description,
    ensureLoaded: state.ensureCosts,
  }),
}))
vi.mock('@/composables/useAttachments', () => ({
  useAttachments: () => ({ attachments: { value: [] }, ensureLoaded: state.ensureAttachments }),
}))
vi.mock('@/composables/useHouseholdObjects', () => ({
  useHouseholdObjects: () => ({ findObject: state.findObject, ensureLoaded: state.ensureObjects }),
}))
vi.mock('@/composables/useTaxCategories', () => ({
  useTaxCategories: () => ({
    categories: {
      value: [{ id: 1, name: 'Spenden', recordsLabourCost: false, sortOrder: 0, createdAt: '', updatedAt: '' }],
    },
  }),
}))

import { useTaxExport } from '@/composables/useTaxExport'

describe('useTaxExport', () => {
  it('loads what the export reads', async () => {
    await useTaxExport().ensureLoaded()
    expect(state.ensureCosts).toHaveBeenCalledTimes(1)
    expect(state.ensureAttachments).toHaveBeenCalledTimes(1)
    expect(state.ensureObjects).toHaveBeenCalledTimes(1)
  })

  it('summarises the export of a year', () => {
    expect(useTaxExport().summaryOf(2026, [1])).toMatchObject({ costCount: 3, totalCents: 300 })
    expect(useTaxExport().summaryOf(2025, [1]).costCount).toBe(0)
  })

  it('does nothing when no folder is picked', async () => {
    vi.mocked(service.pickExportFolder).mockResolvedValue(null)
    await expect(useTaxExport().exportFolder(2026, [1])).resolves.toBeNull()
    expect(service.exportTaxFolder).not.toHaveBeenCalled()
  })

  it('writes the plan into the picked folder, with the names of the objects', async () => {
    const result = { folder: 'C:/Steuer/HomeBase Tax 2026', copied: 0, missing: [] }
    vi.mocked(service.pickExportFolder).mockResolvedValue('C:/Steuer')
    vi.mocked(service.exportTaxFolder).mockResolvedValue(result)
    vi.mocked(state.findObject).mockImplementation((id: number) => (id === 7 ? { name: 'Heat pump' } : undefined))

    await expect(useTaxExport().exportFolder(2026, [1])).resolves.toBe(result)

    const [directory, plan] = (vi.mocked(service.exportTaxFolder).mock.calls[0] ?? []) as [string, TaxExportPlan]
    expect(directory).toBe('C:/Steuer')
    const [sheet] = plan.sheets
    const objectColumn = sheet?.columns.findIndex((column) => column.label === 'Object') ?? -1
    expect(sheet?.rows.map((row) => row[objectColumn])).toEqual([null, 'Heat pump', null])
  })
})
