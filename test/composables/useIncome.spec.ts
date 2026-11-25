import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Income, IncomeInput } from '@/types/income'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({
  listIncome: vi.fn(),
  createIncome: vi.fn(),
  updateIncome: vi.fn(),
  deleteIncome: vi.fn(),
}))
vi.mock('@/services/income.service', () => service)
const refreshAttachments = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useAttachments', () => ({ useAttachments: () => ({ refresh: refreshAttachments }) }))

function income(id: number): Income {
  return {
    id,
    receivedDate: '2026-01-01',
    amountCents: 100,
    description: `#${id}`,
    payer: null,
    paymentMethod: null,
    category: null,
    notes: null,
    householdObjectId: null,
    recurringIncomeId: null,
    createdAt: '',
    updatedAt: '',
  }
}

const input: IncomeInput = { receivedDate: '2026-01-01', amountCents: 1, description: 'x' }

async function load() {
  vi.resetModules()
  const { useIncome } = await import('@/composables/useIncome')
  return useIncome()
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(service.listIncome).mockResolvedValue([income(1), income(2)])
})

describe('useIncome', () => {
  it('loads the income once', async () => {
    const state = await load()
    await state.ensureLoaded()
    await state.ensureLoaded()
    expect(service.listIncome).toHaveBeenCalledTimes(1)
    expect(state.income.value).toHaveLength(2)
    expect(state.findIncome(2)?.description).toBe('#2')
    expect(state.findIncome(9)).toBeUndefined()
  })

  it('does not start a second load while one is running', async () => {
    const state = await load()
    const first = state.refresh()
    await state.ensureLoaded()
    await first
    expect(service.listIncome).toHaveBeenCalledTimes(1)
  })

  it('keeps the error message when loading fails', async () => {
    vi.mocked(service.listIncome).mockRejectedValue(new Error('locked'))
    const state = await load()
    await state.refresh()
    expect(state.error.value).toBe('locked')
    expect(state.isLoading.value).toBe(false)
  })

  it('reloads after every write, and the documents after a delete', async () => {
    vi.mocked(service.createIncome).mockResolvedValue(9)
    const state = await load()
    await expect(state.addIncome(input)).resolves.toBe(9)
    await state.updateIncome(1, input)
    expect(service.createIncome).toHaveBeenCalledWith(input)
    expect(service.updateIncome).toHaveBeenCalledWith(1, input)
    await state.deleteIncome(1)
    expect(service.deleteIncome).toHaveBeenCalledWith(1)
    expect(refreshAttachments).toHaveBeenCalledTimes(1)
    expect(service.listIncome).toHaveBeenCalledTimes(3)
  })
})
