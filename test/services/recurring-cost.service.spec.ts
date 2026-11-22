import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/recurring-cost.repository', () => ({
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  recordPayments: vi.fn(),
}))

import * as repository from '@/repositories/recurring-cost.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import * as service from '@/services/recurring-cost.service'
import { CostValues, type CostInput } from '@/types/cost'
import { RecurringCostValues, type RecurringCost, type RecurringCostInput } from '@/types/recurring-cost'
import type { TaxCategory } from '@/types/tax-category'

const craft: TaxCategory = { id: 2, name: 'Craft', recordsLabourCost: true, sortOrder: 0, createdAt: '', updatedAt: '' }
const input: RecurringCostInput = {
  description: 'Gardener',
  amountCents: 80_00,
  labourCents: 80_00,
  costType: 'service',
  taxCategoryId: 2,
  intervalValue: 1,
  intervalUnit: 'month',
  startDate: '2026-01-15',
  autopay: false,
}
const rule: RecurringCost = {
  ...input,
  id: 4,
  payee: null,
  labourCents: 80_00,
  paymentMethod: null,
  householdObjectId: null,
  endDate: null,
  nextDueDate: '2026-01-15',
  notes: null,
  createdAt: '',
  updatedAt: '',
}
const costInput: CostInput = {
  paidDate: '2026-01-16',
  amountCents: 85_00,
  costType: 'service',
  description: 'Gardener',
  taxCategoryId: 2,
}
const missing = new MissingReferenceError('FOREIGN KEY constraint failed')

describe('rules', () => {
  it('lists, creates and updates rules from validated values', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([])
    await expect(service.listRecurringCosts()).resolves.toEqual([])
    vi.mocked(repository.insert).mockResolvedValue(4)
    await expect(service.createRecurringCost(input, craft)).resolves.toBe(4)
    expect(vi.mocked(repository.insert).mock.calls[0]?.[0]).toBeInstanceOf(RecurringCostValues)
    vi.mocked(repository.update).mockResolvedValue(true)
    await service.updateRecurringCost(4, input, craft)
  })

  it('reports deleted rules and references', async () => {
    vi.mocked(repository.update).mockResolvedValue(false)
    await expect(service.updateRecurringCost(4, input, craft)).rejects.toThrow('This recurring cost no longer exists.')
    vi.mocked(repository.insert).mockRejectedValue(missing)
    await expect(service.createRecurringCost(input, craft)).rejects.toThrow(
      'The selected tax category, object or investment no longer exists.',
    )
    vi.mocked(repository.update).mockRejectedValue(missing)
    await expect(service.updateRecurringCost(4, input, craft)).rejects.toThrow(
      'The selected tax category, object or investment no longer exists.',
    )
    vi.mocked(repository.remove).mockResolvedValue(true)
    await service.deleteRecurringCost(4)
    vi.mocked(repository.remove).mockResolvedValue(false)
    await expect(service.deleteRecurringCost(4)).rejects.toThrow('This recurring cost no longer exists.')
  })
})

describe('payments', () => {
  it('records a confirmed payment with its (corrected) cost and moves the rule on', async () => {
    vi.mocked(repository.recordPayments).mockResolvedValue(1)
    await service.confirmPayment({ rule, dueDate: '2026-01-15', moreCount: 0 }, costInput, craft)
    const [payment] = vi.mocked(repository.recordPayments).mock.calls[0]?.[0] ?? []
    expect(payment).toMatchObject({ ruleId: 4, dueDate: '2026-01-15', nextDueDate: '2026-02-15' })
    expect(payment?.costs[0]).toBeInstanceOf(CostValues)
    expect(payment?.costs[0]?.amountCents).toBe(85_00)
  })

  it('reports a payment recorded meanwhile, or a deleted reference', async () => {
    vi.mocked(repository.recordPayments).mockResolvedValue(0)
    const due = { rule, dueDate: '2026-01-15', moreCount: 0 }
    await expect(service.confirmPayment(due, costInput, craft)).rejects.toThrow('This payment was already recorded.')
    vi.mocked(repository.recordPayments).mockRejectedValue(missing)
    await expect(service.confirmPayment(due, costInput, craft)).rejects.toThrow(
      'The selected tax category, object or investment no longer exists.',
    )
  })

  it('skips a payment, checking the next due date as loaded', async () => {
    vi.mocked(repository.recordPayments).mockResolvedValue(0)
    await service.skipPayment({ rule: { ...rule, nextDueDate: '2026-01-10' }, dueDate: '2026-01-15', moreCount: 1 })
    expect(vi.mocked(repository.recordPayments).mock.calls[0]?.[0]).toEqual([
      { ruleId: 4, dueDate: '2026-01-10', nextDueDate: '2026-02-15', costs: [] },
    ])
  })

  it('creates the due autopay rows, or nothing when none is due', async () => {
    const autopay = { ...rule, autopay: true }
    await expect(service.createDueAutopayCosts([autopay], () => craft, '2026-01-01')).resolves.toBe(0)
    expect(repository.recordPayments).not.toHaveBeenCalled()

    vi.mocked(repository.recordPayments).mockResolvedValue(2)
    await expect(service.createDueAutopayCosts([autopay, rule], () => craft, '2026-02-20')).resolves.toBe(2)
    const [run] = vi.mocked(repository.recordPayments).mock.calls[0]?.[0] ?? []
    expect(run).toMatchObject({ ruleId: 4, dueDate: '2026-01-15', nextDueDate: '2026-03-15' })
    expect(run?.costs.map((cost) => [cost.paidDate, cost.labourCents])).toEqual([
      ['2026-01-15', 80_00],
      ['2026-02-15', 80_00],
    ])
  })
})
