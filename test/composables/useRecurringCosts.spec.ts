import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CostInput } from '@/types/cost'
import type { RecurringCost, RecurringCostInput } from '@/types/recurring-cost'
import { todayIsoDate } from '@/utils/date'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({
  listRecurringCosts: vi.fn(),
  createRecurringCost: vi.fn(),
  updateRecurringCost: vi.fn(),
  deleteRecurringCost: vi.fn(),
  confirmPayment: vi.fn(),
  skipPayment: vi.fn(),
  createDueAutopayCosts: vi.fn(),
}))
vi.mock('@/services/recurring-cost.service', () => service)
const refreshCosts = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useCosts', () => ({ useCosts: () => ({ refresh: refreshCosts }) }))

function rule(id: number, nextDueDate: string): RecurringCost {
  return {
    id,
    description: `#${id}`,
    payee: null,
    amountCents: 100,
    category: 'Miete',
    paymentMethod: null,
    householdObjectId: null,
    intervalValue: 1,
    intervalUnit: 'month',
    startDate: nextDueDate,
    endDate: null,
    nextDueDate,
    autopay: false,
    notes: null,
    createdAt: '',
    updatedAt: '',
  }
}

const input = { description: 'x' } as RecurringCostInput
const costInput = { description: 'x' } as CostInput

async function load() {
  vi.resetModules()
  const { useRecurringCosts } = await import('@/composables/useRecurringCosts')
  return useRecurringCosts()
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(service.listRecurringCosts).mockResolvedValue([rule(1, todayIsoDate()), rule(2, '2999-01-01')])
  vi.mocked(service.createDueAutopayCosts).mockResolvedValue(0)
})

describe('useRecurringCosts', () => {
  it('loads once per session, runs the autopay rules and lists the due payments', async () => {
    const state = await load()
    await state.ensureLoaded()
    await state.ensureLoaded()
    expect(service.listRecurringCosts).toHaveBeenCalledTimes(1)
    expect(service.createDueAutopayCosts).toHaveBeenCalledWith(state.rules.value, todayIsoDate())
    expect(refreshCosts).not.toHaveBeenCalled()
    expect(state.due.value.map((payment) => payment.rule.id)).toEqual([1])
    expect(state.findRule(2)?.description).toBe('#2')
    expect(state.findRule(null)).toBeUndefined()
  })

  it('reloads the rules and costs when autopay created rows', async () => {
    vi.mocked(service.createDueAutopayCosts).mockResolvedValue(3)
    const state = await load()
    await state.ensureLoaded()
    expect(service.listRecurringCosts).toHaveBeenCalledTimes(2)
    expect(refreshCosts).toHaveBeenCalledTimes(1)
  })

  it('keeps the error of loading and of autopay', async () => {
    vi.mocked(service.listRecurringCosts).mockRejectedValue(new Error('locked'))
    const state = await load()
    await state.refresh()
    expect(state.error.value).toBe('locked')
    expect(state.isLoading.value).toBe(false)
    vi.mocked(service.createDueAutopayCosts).mockRejectedValue(new Error('tax category gone'))
    await state.ensureLoaded()
    expect(state.error.value).toBe('tax category gone')
  })

  it('writes and reloads', async () => {
    const state = await load()
    await state.addRule(input)
    await state.updateRule(1, input)
    expect(service.createRecurringCost).toHaveBeenCalledWith(input)
    expect(service.updateRecurringCost).toHaveBeenCalledWith(1, input)
    expect(service.createDueAutopayCosts).toHaveBeenCalledTimes(2)
    await state.deleteRule(1)
    expect(service.deleteRecurringCost).toHaveBeenCalledWith(1)
    const payment = { rule: rule(1, '2026-01-01'), dueDate: '2026-01-01', moreCount: 0 }
    await state.confirmPayment(payment, costInput)
    expect(service.confirmPayment).toHaveBeenCalledWith(payment, costInput)
    await state.skipPayment(payment)
    expect(service.skipPayment).toHaveBeenCalledWith(payment)
    expect(refreshCosts).toHaveBeenCalledTimes(2)
    expect(service.listRecurringCosts).toHaveBeenCalledTimes(5)
  })
})
