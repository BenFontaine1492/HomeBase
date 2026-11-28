import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IncomeInput } from '@/types/income'
import type { RecurringIncome, RecurringIncomeInput } from '@/types/recurring-income'
import { todayIsoDate } from '@/utils/date'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({
  listRecurringIncome: vi.fn(),
  createRecurringIncome: vi.fn(),
  updateRecurringIncome: vi.fn(),
  deleteRecurringIncome: vi.fn(),
  confirmReceipt: vi.fn(),
  skipReceipt: vi.fn(),
  createDueAutopayIncome: vi.fn(),
}))
vi.mock('@/services/recurring-income.service', () => service)
const refreshIncome = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useIncome', () => ({ useIncome: () => ({ refresh: refreshIncome }) }))

function rule(id: number, nextDueDate: string): RecurringIncome {
  return {
    id,
    description: `#${id}`,
    payer: null,
    amountCents: 100,
    category: null,
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

const input = { description: 'x' } as RecurringIncomeInput
const incomeInput = { description: 'x' } as IncomeInput

async function load() {
  vi.resetModules()
  const { useRecurringIncome } = await import('@/composables/useRecurringIncome')
  return useRecurringIncome()
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(service.listRecurringIncome).mockResolvedValue([rule(1, todayIsoDate()), rule(2, '2999-01-01')])
  vi.mocked(service.createDueAutopayIncome).mockResolvedValue(0)
})

describe('useRecurringIncome', () => {
  it('loads once per session, runs the autopay rules and lists the due payments', async () => {
    const state = await load()
    await state.ensureLoaded()
    await state.ensureLoaded()
    expect(service.listRecurringIncome).toHaveBeenCalledTimes(1)
    expect(service.createDueAutopayIncome).toHaveBeenCalledWith(state.rules.value, todayIsoDate())
    expect(refreshIncome).not.toHaveBeenCalled()
    expect(state.due.value.map((payment) => payment.rule.id)).toEqual([1])
  })

  it('reloads the rules and the income when autopay recorded rows', async () => {
    vi.mocked(service.createDueAutopayIncome).mockResolvedValue(3)
    const state = await load()
    await state.ensureLoaded()
    expect(service.listRecurringIncome).toHaveBeenCalledTimes(2)
    expect(refreshIncome).toHaveBeenCalledTimes(1)
  })

  it('keeps the error of loading and of autopay', async () => {
    vi.mocked(service.listRecurringIncome).mockRejectedValue(new Error('locked'))
    const state = await load()
    await state.refresh()
    expect(state.error.value).toBe('locked')
    expect(state.isLoading.value).toBe(false)
    vi.mocked(service.createDueAutopayIncome).mockRejectedValue(new Error('object gone'))
    await state.ensureLoaded()
    expect(state.error.value).toBe('object gone')
  })

  it('writes and reloads', async () => {
    const state = await load()
    await state.addRule(input)
    await state.updateRule(1, input)
    expect(service.createRecurringIncome).toHaveBeenCalledWith(input)
    expect(service.updateRecurringIncome).toHaveBeenCalledWith(1, input)
    expect(service.createDueAutopayIncome).toHaveBeenCalledTimes(2)
    await state.deleteRule(1)
    expect(service.deleteRecurringIncome).toHaveBeenCalledWith(1)
    const payment = { rule: rule(1, '2026-01-01'), dueDate: '2026-01-01', moreCount: 0 }
    await state.confirmReceipt(payment, incomeInput)
    expect(service.confirmReceipt).toHaveBeenCalledWith(payment, incomeInput)
    await state.skipReceipt(payment)
    expect(service.skipReceipt).toHaveBeenCalledWith(payment)
    expect(refreshIncome).toHaveBeenCalledTimes(2)
    expect(service.listRecurringIncome).toHaveBeenCalledTimes(5)
  })
})
