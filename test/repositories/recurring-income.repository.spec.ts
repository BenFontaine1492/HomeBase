import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn(), transaction: vi.fn() }))

import { execute, select, transaction } from '@/infrastructure/database'
import * as repository from '@/repositories/recurring-income.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import { IncomeValues } from '@/types/income'
import { RecurringIncomeValues } from '@/types/recurring-income'

const values = RecurringIncomeValues.from({
  description: 'Miete DG',
  amountCents: 800_00,
  intervalValue: 1,
  intervalUnit: 'month',
  startDate: '2026-01-01',
  autopay: true,
})
const params = ['Miete DG', null, 800_00, null, null, null, 1, 'month', '2026-01-01', null, 1, null]
const income = IncomeValues.from({
  receivedDate: '2026-02-01',
  amountCents: 800_00,
  description: 'Miete DG',
})

describe('findAll', () => {
  it('maps rows to rules', async () => {
    vi.mocked(select).mockResolvedValue([
      {
        id: 1,
        description: 'Miete DG',
        payer: 'Weber',
        amount_cents: 800_00,
        category: 'Miete',
        payment_method: 'transfer',
        household_object_id: null,
        interval_value: 1,
        interval_unit: 'month',
        start_date: '2026-01-01',
        end_date: null,
        next_due_date: '2026-02-01',
        autopay: 0,
        notes: 'n',
        created_at: 'c',
        updated_at: 'u',
      },
    ])
    await expect(repository.findAll()).resolves.toEqual([
      {
        id: 1,
        description: 'Miete DG',
        payer: 'Weber',
        amountCents: 800_00,
        category: 'Miete',
        paymentMethod: 'transfer',
        householdObjectId: null,
        intervalValue: 1,
        intervalUnit: 'month',
        startDate: '2026-01-01',
        endDate: null,
        nextDueDate: '2026-02-01',
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
    expect(sql).toContain('$12, $9)')
    expect(inserted).toEqual(params)
    await repository.insert(RecurringIncomeValues.from({ ...values, autopay: false }))
    expect(vi.mocked(execute).mock.calls[1]?.[1]?.[10]).toBe(0)
  })

  it('updates and deletes, reporting whether the rule exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.update(3, values)).resolves.toBe(true)
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual([...params, 3])
    expect(vi.mocked(execute).mock.calls[0]?.[0]).toContain('next_due_date = max(next_due_date, $9)')
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

describe('recordReceipts', () => {
  it('moves each rule on and inserts its income in one transaction, counting the inserted rows', async () => {
    vi.mocked(transaction).mockResolvedValue([
      { rowsAffected: 1 },
      { rowsAffected: 1 },
      { rowsAffected: 1 },
      { rowsAffected: 0 },
    ])
    const recorded = await repository.recordReceipts([
      { ruleId: 1, dueDate: '2026-01-01', nextDueDate: '2026-03-01', income: [income, income] },
      { ruleId: 2, dueDate: '2026-02-01', nextDueDate: '2026-03-01', income: [] },
    ])
    expect(recorded).toBe(2)
    const statements = vi.mocked(transaction).mock.calls[0]?.[0] ?? []
    expect(statements).toHaveLength(4)
    expect(statements[0]?.params).toEqual(['2026-03-01', 1, '2026-01-01'])
    expect(statements[1]?.sql).toContain('WHERE changes() = 1')
    expect(statements[1]?.params.at(-1)).toBe(1)
    expect(statements[3]?.params).toEqual(['2026-03-01', 2, '2026-02-01'])
  })

  it('reports a missing reference as MissingReferenceError', async () => {
    vi.mocked(transaction).mockRejectedValue(new Error('FOREIGN KEY constraint failed'))
    await expect(
      repository.recordReceipts([{ ruleId: 1, dueDate: 'd', nextDueDate: 'n', income: [income] }]),
    ).rejects.toBeInstanceOf(MissingReferenceError)
  })
})
