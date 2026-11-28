import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Investment } from '@/types/investment'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({
  listInvestments: vi.fn(),
  createInvestment: vi.fn(),
  updateInvestment: vi.fn(),
  markPurchased: vi.fn(),
  markPlanned: vi.fn(),
  reorderInvestments: vi.fn(),
  deleteInvestment: vi.fn(),
}))
vi.mock('@/services/investment.service', () => service)

function investment(id: number, estimatedCostCents: number, changes: Partial<Investment> = {}): Investment {
  return {
    id,
    projectId: 1,
    title: `#${id}`,
    description: null,
    estimatedCostCents,
    priority: 'medium',
    sortOrder: id,
    status: 'planned',
    purchasedDate: null,
    targetDate: null,
    budgetCents: null,
    savedCents: null,
    createdAt: '',
    updatedAt: '',
    ...changes,
  }
}

/** Fresh module-level state for every test. */
async function load() {
  vi.resetModules()
  const { useInvestments } = await import('@/composables/useInvestments')
  return useInvestments()
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useInvestments', () => {
  it('loads once, splits planned and purchased, and sums the planned costs', async () => {
    vi.mocked(service.listInvestments).mockResolvedValue([
      investment(1, 100),
      investment(2, 250),
      investment(3, 999, { status: 'purchased', purchasedDate: '2026-01-01' }),
    ])
    const state = await load()
    expect(state.totalEstimatedCostCents.value).toBe(0)

    await state.ensureLoaded()
    await state.ensureLoaded()

    expect(service.listInvestments).toHaveBeenCalledTimes(1)
    expect(state.investments.value).toHaveLength(3)
    expect(state.planned.value.map(({ id }) => id)).toEqual([1, 2])
    expect(state.purchased.value.map(({ id }) => id)).toEqual([3])
    expect(state.totalEstimatedCostCents.value).toBe(350)
    expect(state.isLoading.value).toBe(false)
    expect(state.error.value).toBeNull()
  })

  it('does not start a second load while one is running', async () => {
    let finish: (rows: Investment[]) => void = () => {}
    vi.mocked(service.listInvestments).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const state = await load()

    const first = state.refresh()
    expect(state.isLoading.value).toBe(true)
    await state.ensureLoaded()
    finish([])
    await first

    expect(service.listInvestments).toHaveBeenCalledTimes(1)
  })

  it('keeps the error message when loading fails, and retries on ensureLoaded', async () => {
    vi.mocked(service.listInvestments).mockRejectedValueOnce(new Error('db gone')).mockResolvedValue([])
    const state = await load()

    await state.ensureLoaded()
    expect(state.error.value).toBe('db gone')
    expect(state.isLoading.value).toBe(false)

    await state.ensureLoaded()
    expect(state.error.value).toBeNull()
    expect(service.listInvestments).toHaveBeenCalledTimes(2)
  })

  it('reloads after every write', async () => {
    vi.mocked(service.listInvestments).mockResolvedValue([])
    const state = await load()
    const input = { projectId: 1, title: 't', estimatedCostCents: 1, priority: 'low' } as const
    const stored = investment(1, 1)

    await state.addInvestment(input)
    await state.updateInvestment(1, input)
    await state.markPurchased(stored, '2026-11-18')
    await state.markPlanned(stored)
    await state.deleteInvestment(1)

    expect(service.createInvestment).toHaveBeenCalledWith(input)
    expect(service.updateInvestment).toHaveBeenCalledWith(1, input)
    expect(service.markPurchased).toHaveBeenCalledWith(stored, '2026-11-18')
    expect(service.markPlanned).toHaveBeenCalledWith(stored)
    expect(service.deleteInvestment).toHaveBeenCalledWith(1)
    expect(service.listInvestments).toHaveBeenCalledTimes(5)
  })

  it('moves a planned investment and saves the new order', async () => {
    vi.mocked(service.listInvestments).mockResolvedValue([investment(1, 1), investment(2, 1), investment(3, 1)])
    const state = await load()
    await state.ensureLoaded()

    await state.moveInvestment(3, 0)
    expect(service.reorderInvestments).toHaveBeenCalledWith([3, 1, 2])
    expect(service.listInvestments).toHaveBeenCalledTimes(2)
  })

  it('moves an investment within its own project only', async () => {
    vi.mocked(service.listInvestments).mockResolvedValue([
      investment(1, 1),
      investment(2, 1, { projectId: 2 }),
      investment(3, 1, { projectId: 2 }),
    ])
    const state = await load()
    await state.ensureLoaded()

    await state.moveInvestment(3, 0)
    expect(service.reorderInvestments).toHaveBeenCalledWith([3, 2])
  })

  it('ignores an unknown investment', async () => {
    vi.mocked(service.listInvestments).mockResolvedValue([investment(1, 1)])
    const state = await load()
    await state.ensureLoaded()

    await state.moveInvestment(9, 0)
    expect(service.reorderInvestments).not.toHaveBeenCalled()
  })

  it('does nothing when the order stays the same', async () => {
    vi.mocked(service.listInvestments).mockResolvedValue([investment(1, 1), investment(2, 1)])
    const state = await load()
    await state.ensureLoaded()

    await state.moveInvestment(1, 0)
    expect(service.reorderInvestments).not.toHaveBeenCalled()
    expect(service.listInvestments).toHaveBeenCalledTimes(1)
  })

  it('reloads and rethrows when saving the order fails', async () => {
    vi.mocked(service.listInvestments).mockResolvedValue([investment(1, 1), investment(2, 1)])
    vi.mocked(service.reorderInvestments).mockRejectedValue(new Error('locked'))
    const state = await load()
    await state.ensureLoaded()

    await expect(state.moveInvestment(2, 0)).rejects.toThrow('locked')
    expect(service.listInvestments).toHaveBeenCalledTimes(2)
  })

  it('rethrows write errors without reloading', async () => {
    vi.mocked(service.deleteInvestment).mockRejectedValue(new Error('gone'))
    const state = await load()
    await expect(state.deleteInvestment(1)).rejects.toThrow('gone')
    expect(service.listInvestments).not.toHaveBeenCalled()
  })
})
