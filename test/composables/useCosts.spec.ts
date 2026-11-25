import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Cost, CostInput } from '@/types/cost'
import type { TaxCategory } from '@/types/tax-category'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({
  listCosts: vi.fn(),
  createCost: vi.fn(),
  updateCost: vi.fn(),
  updateCostDetails: vi.fn(),
  deleteCost: vi.fn(),
}))
vi.mock('@/services/cost.service', () => service)
const craft: TaxCategory = { id: 2, name: 'Craft', recordsLabourCost: true, sortOrder: 0, createdAt: '', updatedAt: '' }
const taxCategories = vi.hoisted(() => ({ ensureLoaded: vi.fn(), findCategory: vi.fn() }))
vi.mock('@/composables/useTaxCategories', () => ({ useTaxCategories: () => taxCategories }))
const refreshAttachments = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useAttachments', () => ({ useAttachments: () => ({ refresh: refreshAttachments }) }))
const maintenance = vi.hoisted(() => ({
  ensureLoaded: vi.fn(),
  records: {
    value: [
      { id: 4, taskId: 3 },
      { id: 5, taskId: null },
    ],
  },
  findTask: (id: number | null) => (id === 3 ? { name: 'Annual service' } : undefined),
}))
vi.mock('@/composables/useMaintenance', () => ({ useMaintenance: () => maintenance }))

function cost(id: number): Cost {
  return {
    id,
    paidDate: '2026-01-01',
    amountCents: 100,
    labourCents: null,
    costType: 'other',
    description: `#${id}`,
    payee: null,
    paymentMethod: null,
    notes: null,
    taxCategoryId: null,
    householdObjectId: null,
    maintenanceRecordId: null,
    investmentId: null,
    recurringCostId: null,
    objectId: null,
    createdAt: '',
    updatedAt: '',
  }
}

const input: CostInput = {
  paidDate: '2026-01-01',
  amountCents: 1,
  costType: 'repair',
  description: 'x',
  taxCategoryId: 2,
}

async function load() {
  vi.resetModules()
  const { useCosts } = await import('@/composables/useCosts')
  return useCosts()
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(service.listCosts).mockResolvedValue([cost(1), cost(2)])
  vi.mocked(taxCategories.findCategory).mockReturnValue(craft)
})

describe('useCosts', () => {
  it('loads the costs once, and the tax categories', async () => {
    const state = await load()
    await state.ensureLoaded()
    await state.ensureLoaded()
    expect(service.listCosts).toHaveBeenCalledTimes(1)
    expect(taxCategories.ensureLoaded).toHaveBeenCalledTimes(2)
    expect(state.costs.value).toHaveLength(2)
    expect(state.findCost(2)?.description).toBe('#2')
    expect(state.findCost(9)).toBeUndefined()
    expect(state.titleOf(cost(1))).toBe('#1')
    expect(state.titleOf({ ...cost(1), description: null, maintenanceRecordId: 4 })).toBe('Annual service')
    expect(state.titleOf({ ...cost(1), description: null, maintenanceRecordId: 5 })).toBe('Maintenance')
    expect(state.titleOf({ ...cost(1), description: null, maintenanceRecordId: 9 })).toBe('Maintenance')
    expect(maintenance.ensureLoaded).toHaveBeenCalledTimes(2)
  })

  it('does not start a second load while one is running', async () => {
    const state = await load()
    const first = state.refresh()
    await state.ensureLoaded()
    await first
    expect(service.listCosts).toHaveBeenCalledTimes(1)
  })

  it('keeps the error message when loading fails', async () => {
    vi.mocked(service.listCosts).mockRejectedValue(new Error('locked'))
    const state = await load()
    await state.refresh()
    expect(state.error.value).toBe('locked')
    expect(state.isLoading.value).toBe(false)
  })

  it('passes the selected tax category and reloads after every write', async () => {
    vi.mocked(service.createCost).mockResolvedValue(9)
    const state = await load()
    await expect(state.addCost(input)).resolves.toBe(9)
    await state.updateCost(1, input)
    expect(taxCategories.findCategory).toHaveBeenCalledWith(2)
    expect(service.createCost).toHaveBeenCalledWith(input, craft)
    expect(service.updateCost).toHaveBeenCalledWith(1, input, craft)
    expect(service.listCosts).toHaveBeenCalledTimes(2)
    vi.mocked(service.listCosts).mockResolvedValue([{ ...cost(3), maintenanceRecordId: 4, amountCents: 900 }])
    await state.refresh()
    await state.updateCost(3, input)
    expect(service.updateCostDetails).toHaveBeenCalledWith(3, input, craft, 900)
    expect(service.updateCost).toHaveBeenCalledTimes(1)
    await state.deleteCost(1)
    expect(service.deleteCost).toHaveBeenCalledWith(1)
    expect(refreshAttachments).toHaveBeenCalledTimes(1)
  })
})
