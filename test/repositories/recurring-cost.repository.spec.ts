import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn(), transaction: vi.fn() }))

import { execute, select, transaction } from '@/infrastructure/database'
import * as repository from '@/repositories/recurring-cost.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import { CostValues } from '@/types/cost'
import { RecurringCostValues } from '@/types/recurring-cost'

const values = RecurringCostValues.from(
  {
    description: 'Hausrat',
    amountCents: 40_00,
    costType: 'insurance',
    taxCategoryId: null,
    intervalValue: 1,
    intervalUnit: 'month',
    startDate: '2026-01-01',
    autopay: true,
  },
  undefined,
)
const params = ['Hausrat', null, 40_00, null, 'insurance', null, null, null, 1, 'month', '2026-01-01', null, 1, null]
const cost = CostValues.from(
  { paidDate: '2026-02-01', amountCents: 40_00, costType: 'insurance', description: 'Hausrat', taxCategoryId: null },
  undefined,
)

describe('findAll', () => {
  it('maps rows to rules', async () => {
    vi.mocked(select).mockResolvedValue([
      {
        id: 1,
        description: 'Hausrat',
        payee: 'Allianz',
        amount_cents: 40_00,
        labour_cents: null,
        cost_type: 'insurance',
        tax_category_id: 4,
        payment_method: 'direct-debit',
        household_object_id: null,
        interval_value: 1,
        interval_unit: 'year',
        start_date: '2026-01-01',
        end_date: null,
        next_due_date: '2027-01-01',
        autopay: 0,
        notes: 'n',
        created_at: 'c',
        updated_at: 'u',
      },
    ])
    await expect(repository.findAll()).resolves.toEqual([
      {
        id: 1,
        description: 'Hausrat',
        payee: 'Allianz',
        amountCents: 40_00,
        labourCents: null,
        costType: 'insurance',
        taxCategoryId: 4,
        paymentMethod: 'direct-debit',
        householdObjectId: null,
        intervalValue: 1,
        intervalUnit: 'year',
        startDate: '2026-01-01',
        endDate: null,
        nextDueDate: '2027-01-01',
        autopay: false,
        notes: 'n',
        createdAt: 'c',
        updatedAt: 'u',
      },
    ])
  })
})

describe('rules', () => {
  it('inserts a rule due on its start date', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 3 })
    await expect(repository.insert(values)).resolves.toBe(3)
    const [sql, inserted] = vi.mocked(execute).mock.calls[0] ?? []
    expect(sql).toContain('$14, $11)')
    expect(inserted).toEqual(params)
    const manual = RecurringCostValues.from({ ...values, autopay: false, taxCategoryId: null }, undefined)
    await repository.insert(manual)
    expect(vi.mocked(execute).mock.calls[1]?.[1]?.[12]).toBe(0)
  })

  it('updates and deletes, reporting whether the rule exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.update(3, values)).resolves.toBe(true)
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual([...params, 3])
    expect(vi.mocked(execute).mock.calls[0]?.[0]).toContain('next_due_date = max(next_due_date, $11)')
    await expect(repository.remove(3)).resolves.toBe(true)
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(repository.update(3, values)).resolves.toBe(false)
    await expect(repository.remove(3)).resolves.toBe(false)
  })

  it('reports a missing reference as MissingReferenceError', async () => {
    vi.mocked(execute).mockRejectedValue(new Error('FOREIGN KEY constraint failed'))
    await expect(repository.insert(values)).rejects.toBeInstanceOf(MissingReferenceError)
    await expect(repository.update(3, values)).rejects.toBeInstanceOf(MissingReferenceError)
  })
})

describe('recordPayments', () => {
  it('moves each rule on and inserts its costs in one transaction, counting the inserted costs', async () => {
    vi.mocked(transaction).mockResolvedValue([
      { rowsAffected: 1 },
      { rowsAffected: 1 },
      { rowsAffected: 1 },
      { rowsAffected: 0 },
      { rowsAffected: 0 },
    ])
    const recorded = await repository.recordPayments([
      { ruleId: 1, dueDate: '2026-01-01', nextDueDate: '2026-03-01', costs: [cost, cost] },
      { ruleId: 2, dueDate: '2026-02-01', nextDueDate: '2026-03-01', costs: [cost] },
    ])
    expect(recorded).toBe(2)
    const statements = vi.mocked(transaction).mock.calls[0]?.[0] ?? []
    expect(statements.map((statement) => statement.params[0])).toEqual([
      '2026-03-01',
      '2026-02-01',
      '2026-02-01',
      '2026-03-01',
      '2026-02-01',
    ])
    expect(statements[0]?.params).toEqual(['2026-03-01', 1, '2026-01-01'])
    expect(statements[1]?.sql).toContain('WHERE changes() = 1')
    expect(statements[1]?.params.at(-1)).toBe(1)
  })

  it('reports a missing reference as MissingReferenceError', async () => {
    vi.mocked(transaction).mockRejectedValue(new Error('FOREIGN KEY constraint failed'))
    await expect(
      repository.recordPayments([{ ruleId: 1, dueDate: 'd', nextDueDate: 'n', costs: [cost] }]),
    ).rejects.toBeInstanceOf(MissingReferenceError)
  })
})
