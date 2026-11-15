import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Investment } from '@/types/investment'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({
  listInvestments: vi.fn(),
  createInvestment: vi.fn(),
  updateInvestment: vi.fn(),
  deleteInvestment: vi.fn(),
}))
vi.mock('@/services/investment.service', () => service)

function investment(id: number, estimatedCostCents: number): Investment {
  return { id, title: `#${id}`, description: null, estimatedCostCents, priority: 'medium', sortOrder: id, createdAt: '', updatedAt: '' }
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
  it('loads once and sums the estimated costs', async () => {
    vi.mocked(service.listInvestments).mockResolvedValue([investment(1, 100), investment(2, 250)])
    const state = await load()
    expect(state.totalEstimatedCostCents.value).toBe(0)

    await state.ensureLoaded()
    await state.ensureLoaded()

    expect(service.listInvestments).toHaveBeenCalledTimes(1)
    expect(state.investments.value).toHaveLength(2)
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
    const input = { title: 't', estimatedCostCents: 1, priority: 'low' } as const

    await state.addInvestment(input)
    await state.updateInvestment(1, input)
    await state.deleteInvestment(1)

    expect(service.createInvestment).toHaveBeenCalledWith(input)
    expect(service.updateInvestment).toHaveBeenCalledWith(1, input)
    expect(service.deleteInvestment).toHaveBeenCalledWith(1)
    expect(service.listInvestments).toHaveBeenCalledTimes(3)
  })

  it('rethrows write errors without reloading', async () => {
    vi.mocked(service.deleteInvestment).mockRejectedValue(new Error('gone'))
    const state = await load()
    await expect(state.deleteInvestment(1)).rejects.toThrow('gone')
    expect(service.listInvestments).not.toHaveBeenCalled()
  })
})
