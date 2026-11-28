import { describe, expect, it, vi } from 'vitest'
import type { Cost } from '@/types/cost'
import type { Income } from '@/types/income'
import type { TaxExportPlan, TaxExportSelection } from '@/types/tax-export'

const service = vi.hoisted(() => ({ pickExportFolder: vi.fn(), exportTaxFolder: vi.fn() }))
vi.mock('@/services/tax-export.service', () => service)

function cost(id: number, objectId: number | null): Cost {
  return {
    id,
    paidDate: '2026-03-01',
    amountCents: 100,
    category: 'Spenden',
    description: `#${id}`,
    payee: null,
    paymentMethod: null,
    notes: null,
    householdObjectId: objectId,
    maintenanceRecordId: null,
    investmentId: null,
    recurringCostId: null,
    objectId,
    createdAt: '',
    updatedAt: '',
  }
}

function income(id: number, householdObjectId: number | null): Income {
  return {
    id,
    receivedDate: '2026-02-01',
    amountCents: 50,
    description: `In ${id}`,
    payer: null,
    paymentMethod: null,
    category: 'Photovoltaik',
    notes: null,
    householdObjectId,
    recurringIncomeId: null,
    createdAt: '',
    updatedAt: '',
  }
}

const state = vi.hoisted(() => ({
  ensureCosts: vi.fn(),
  ensureIncome: vi.fn(),
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
vi.mock('@/composables/useIncome', () => ({
  useIncome: () => ({ income: { value: [income(1, 7), income(2, null)] }, ensureLoaded: state.ensureIncome }),
}))
vi.mock('@/composables/useAttachments', () => ({
  useAttachments: () => ({ attachments: { value: [] }, ensureLoaded: state.ensureAttachments }),
}))
vi.mock('@/composables/useHouseholdObjects', () => ({
  useHouseholdObjects: () => ({ findObject: state.findObject, ensureLoaded: state.ensureObjects }),
}))

import { useTaxExport } from '@/composables/useTaxExport'

function selection(fields: Partial<TaxExportSelection> = {}): TaxExportSelection {
  return { year: 2026, includeCosts: true, includeIncome: false, ...fields }
}

describe('useTaxExport', () => {
  it('loads what the export reads', async () => {
    await useTaxExport().ensureLoaded()
    expect(state.ensureCosts).toHaveBeenCalledTimes(1)
    expect(state.ensureIncome).toHaveBeenCalledTimes(1)
    expect(state.ensureAttachments).toHaveBeenCalledTimes(1)
    expect(state.ensureObjects).toHaveBeenCalledTimes(1)
  })

  it('summarises the export of a year', () => {
    expect(useTaxExport().summaryOf(selection())).toMatchObject({ costCount: 3, costTotalCents: 300, incomeCount: 0 })
    expect(useTaxExport().summaryOf(selection({ year: 2025 })).costCount).toBe(0)
    expect(useTaxExport().summaryOf(selection({ includeIncome: true }))).toMatchObject({
      incomeCount: 2,
      incomeTotalCents: 100,
    })
  })

  it('does nothing when no folder is picked', async () => {
    vi.mocked(service.pickExportFolder).mockResolvedValue(null)
    await expect(useTaxExport().exportFolder(selection())).resolves.toBeNull()
    expect(service.exportTaxFolder).not.toHaveBeenCalled()
  })

  it('writes the plan into the picked folder, with the names of the objects', async () => {
    const result = { folder: 'C:/Steuer/HomeBase Tax 2026', copied: 0, missing: [] }
    vi.mocked(service.pickExportFolder).mockResolvedValue('C:/Steuer')
    vi.mocked(service.exportTaxFolder).mockResolvedValue(result)
    vi.mocked(state.findObject).mockImplementation((id: number) => (id === 7 ? { name: 'Heat pump' } : undefined))

    await expect(useTaxExport().exportFolder(selection({ includeIncome: true }))).resolves.toBe(result)

    const [directory, plan] = (vi.mocked(service.exportTaxFolder).mock.calls[0] ?? []) as [string, TaxExportPlan]
    expect(directory).toBe('C:/Steuer')
    const [sheet] = plan.sheets
    const objectColumn = sheet?.columns.findIndex((column) => column.label === 'Object') ?? -1
    expect(sheet?.rows.map((row) => row[objectColumn])).toEqual([null, 'Heat pump', null])
    const incomeSheet = plan.sheets[1]
    const incomeObjectColumn = incomeSheet?.columns.findIndex((column) => column.label === 'Object') ?? -1
    expect(incomeSheet?.rows.map((row) => row[incomeObjectColumn])).toEqual(['Heat pump', null])
  })
})
