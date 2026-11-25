import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaxCategory } from '@/types/tax-category'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({
  listTaxCategories: vi.fn(),
  createTaxCategory: vi.fn(),
  updateTaxCategory: vi.fn(),
  deleteTaxCategory: vi.fn(),
  addDefaultTaxCategories: vi.fn(),
}))
vi.mock('@/services/tax-category.service', () => service)
const refreshCosts = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useCosts', () => ({ useCosts: () => ({ refresh: refreshCosts }) }))
const refreshRules = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useRecurringCosts', () => ({ useRecurringCosts: () => ({ refresh: refreshRules }) }))

function category(id: number): TaxCategory {
  return { id, name: `#${id}`, recordsLabourCost: false, sortOrder: id, createdAt: '', updatedAt: '' }
}

async function load() {
  vi.resetModules()
  const { useTaxCategories } = await import('@/composables/useTaxCategories')
  return useTaxCategories()
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(service.listTaxCategories).mockResolvedValue([category(1), category(2)])
})

describe('useTaxCategories', () => {
  it('loads once and finds categories by id', async () => {
    const state = await load()
    await state.ensureLoaded()
    await state.ensureLoaded()
    expect(service.listTaxCategories).toHaveBeenCalledTimes(1)
    expect(state.categories.value).toHaveLength(2)
    expect(state.findCategory(2)?.name).toBe('#2')
    expect(state.findCategory(9)).toBeUndefined()
    expect(state.findCategory(null)).toBeUndefined()
  })

  it('does not start a second load while one is running', async () => {
    const state = await load()
    const first = state.refresh()
    await state.ensureLoaded()
    await first
    expect(service.listTaxCategories).toHaveBeenCalledTimes(1)
  })

  it('keeps the error message when loading fails', async () => {
    vi.mocked(service.listTaxCategories).mockRejectedValue(new Error('locked'))
    const state = await load()
    await state.refresh()
    expect(state.error.value).toBe('locked')
    expect(state.isLoading.value).toBe(false)
  })

  it('reloads after every write; deleting also reloads the costs', async () => {
    const state = await load()
    const input = { name: 'X', recordsLabourCost: false }
    await state.addCategory(input)
    await state.updateCategory(1, input)
    await state.addDefaults()
    expect(service.createTaxCategory).toHaveBeenCalledWith(input)
    expect(service.updateTaxCategory).toHaveBeenCalledWith(1, input)
    expect(service.addDefaultTaxCategories).toHaveBeenCalledTimes(1)
    expect(service.listTaxCategories).toHaveBeenCalledTimes(3)
    await state.deleteCategory(1)
    expect(service.deleteTaxCategory).toHaveBeenCalledWith(1)
    expect(refreshCosts).toHaveBeenCalledTimes(1)
    expect(refreshRules).toHaveBeenCalledTimes(1)
  })
})
