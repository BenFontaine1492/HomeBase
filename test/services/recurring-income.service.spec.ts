import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/recurring-income.repository', () => ({
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  recordReceipts: vi.fn(),
}))

import * as repository from '@/repositories/recurring-income.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import * as service from '@/services/recurring-income.service'
import { IncomeValues, type IncomeInput } from '@/types/income'
import { RecurringIncomeValues, type RecurringIncome, type RecurringIncomeInput } from '@/types/recurring-income'

const input: RecurringIncomeInput = {
  description: 'Miete DG',
  amountCents: 800_00,
  category: 'Miete',
  intervalValue: 1,
  intervalUnit: 'month',
  startDate: '2026-01-15',
  autopay: false,
}
const rule: RecurringIncome = {
  ...input,
  id: 4,
  payer: null,
  category: 'Miete',
  paymentMethod: null,
  householdObjectId: null,
  endDate: null,
  nextDueDate: '2026-01-15',
  notes: null,
  createdAt: '',
  updatedAt: '',
}
const incomeInput: IncomeInput = {
  receivedDate: '2026-01-16',
  amountCents: 750_00,
  description: 'Miete DG',
}
const missing = new MissingReferenceError('FOREIGN KEY constraint failed')

describe('rules', () => {
  it('lists, creates and updates rules from validated values', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([])
    await expect(service.listRecurringIncome()).resolves.toEqual([])
    vi.mocked(repository.insert).mockResolvedValue(4)
    await expect(service.createRecurringIncome(input)).resolves.toBe(4)
    expect(vi.mocked(repository.insert).mock.calls[0]?.[0]).toBeInstanceOf(RecurringIncomeValues)
    vi.mocked(repository.update).mockResolvedValue(true)
    await service.updateRecurringIncome(4, input)
  })

  it('reports deleted rules and objects', async () => {
    vi.mocked(repository.update).mockResolvedValue(false)
    await expect(service.updateRecurringIncome(4, input)).rejects.toThrow('This recurring income no longer exists.')
    vi.mocked(repository.insert).mockRejectedValue(missing)
    await expect(service.createRecurringIncome(input)).rejects.toThrow('The selected object no longer exists.')
    vi.mocked(repository.update).mockRejectedValue(missing)
    await expect(service.updateRecurringIncome(4, input)).rejects.toThrow('The selected object no longer exists.')
    vi.mocked(repository.remove).mockResolvedValue(true)
    await service.deleteRecurringIncome(4)
    vi.mocked(repository.remove).mockResolvedValue(false)
    await expect(service.deleteRecurringIncome(4)).rejects.toThrow('This recurring income no longer exists.')
  })
})

describe('receipts', () => {
  it('records a confirmed payment with its (corrected) income and moves the rule on', async () => {
    vi.mocked(repository.recordReceipts).mockResolvedValue(1)
    await service.confirmReceipt({ rule, dueDate: '2026-01-15', moreCount: 0 }, incomeInput)
    const [receipt] = vi.mocked(repository.recordReceipts).mock.calls[0]?.[0] ?? []
    expect(receipt).toMatchObject({ ruleId: 4, dueDate: '2026-01-15', nextDueDate: '2026-02-15' })
    expect(receipt?.income[0]).toBeInstanceOf(IncomeValues)
    expect(receipt?.income[0]?.amountCents).toBe(750_00)
  })

  it('reports a payment recorded meanwhile, or a deleted object', async () => {
    const due = { rule, dueDate: '2026-01-15', moreCount: 0 }
    vi.mocked(repository.recordReceipts).mockResolvedValue(0)
    await expect(service.confirmReceipt(due, incomeInput)).rejects.toThrow('This payment was already recorded.')
    vi.mocked(repository.recordReceipts).mockRejectedValue(missing)
    await expect(service.confirmReceipt(due, incomeInput)).rejects.toThrow('The selected object no longer exists.')
  })

  it('skips a payment, checking the next due date as loaded', async () => {
    vi.mocked(repository.recordReceipts).mockResolvedValue(0)
    await service.skipReceipt({ rule: { ...rule, nextDueDate: '2026-01-10' }, dueDate: '2026-01-15', moreCount: 1 })
    expect(vi.mocked(repository.recordReceipts).mock.calls[0]?.[0]).toEqual([
      { ruleId: 4, dueDate: '2026-01-10', nextDueDate: '2026-02-15', income: [] },
    ])
  })

  it('records the due autopay rows, or nothing when none is due', async () => {
    const autopay = { ...rule, autopay: true }
    await expect(service.createDueAutopayIncome([autopay], '2026-01-01')).resolves.toBe(0)
    expect(repository.recordReceipts).not.toHaveBeenCalled()

    vi.mocked(repository.recordReceipts).mockResolvedValue(2)
    await expect(service.createDueAutopayIncome([autopay, rule], '2026-02-20')).resolves.toBe(2)
    const [run] = vi.mocked(repository.recordReceipts).mock.calls[0]?.[0] ?? []
    expect(run).toMatchObject({ ruleId: 4, dueDate: '2026-01-15', nextDueDate: '2026-03-15' })
    expect(run?.income.map((entry) => [entry.receivedDate, entry.category])).toEqual([
      ['2026-01-15', 'Miete'],
      ['2026-02-15', 'Miete'],
    ])
  })
})
