import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn(), transaction: vi.fn() }))

import { execute, select, transaction } from '@/infrastructure/database'
import * as repository from '@/repositories/investment.repository'
import { InvestmentOrder, InvestmentValues } from '@/types/investment'

const values = InvestmentValues.from({
  title: 'Heat pump',
  estimatedCostCents: 1_500_000,
  priority: 'high',
  targetDate: '2027-03-01',
  budgetCents: 1_600_000,
  savedCents: 200_000,
})
const params = ['Heat pump', null, 1_500_000, 'high', 'planned', null, '2027-03-01', 1_600_000, 200_000]

describe('findAll', () => {
  it('maps snake_case rows in list order', async () => {
    vi.mocked(select).mockResolvedValue([
      {
        id: 1,
        title: 'Roof',
        description: null,
        estimated_cost_cents: 100,
        priority: 'low',
        sort_order: 3,
        status: 'purchased',
        purchased_date: '2026-11-01',
        target_date: null,
        budget_cents: 120,
        saved_cents: null,
        created_at: 'c',
        updated_at: 'u',
      },
    ])
    await expect(repository.findAll()).resolves.toEqual([
      {
        id: 1,
        title: 'Roof',
        description: null,
        estimatedCostCents: 100,
        priority: 'low',
        sortOrder: 3,
        status: 'purchased',
        purchasedDate: '2026-11-01',
        targetDate: null,
        budgetCents: 120,
        savedCents: null,
        createdAt: 'c',
        updatedAt: 'u',
      },
    ])
    expect(select).toHaveBeenCalledWith(expect.stringContaining('ORDER BY sort_order ASC, id ASC'))
  })
})

describe('insert', () => {
  it('appends the investment and returns its id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 9 })
    await expect(repository.insert(values)).resolves.toBe(9)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('COALESCE(MAX(sort_order), 0) + 1'), params)
  })

  it('fails when the database returns no id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.insert(values)).rejects.toThrow('The database did not return an id for the new investment.')
  })
})

describe('update', () => {
  it('updates the row by id and reports whether it existed', async () => {
    vi.mocked(execute).mockResolvedValueOnce({ rowsAffected: 1 }).mockResolvedValueOnce({ rowsAffected: 0 })
    await expect(repository.update(4, values)).resolves.toBe(true)
    await expect(repository.update(4, values)).resolves.toBe(false)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE investments'), [...params, 4])
  })
})

describe('reorder', () => {
  it('numbers the listed investments 1, 2, … in one transaction', async () => {
    vi.mocked(transaction).mockResolvedValue([])
    await repository.reorder(InvestmentOrder.from([5, 2]))
    expect(transaction).toHaveBeenCalledWith([
      { sql: 'UPDATE investments SET sort_order = $1 WHERE id = $2', params: [1, 5] },
      { sql: 'UPDATE investments SET sort_order = $1 WHERE id = $2', params: [2, 2] },
    ])
  })
})

describe('remove', () => {
  it('deletes the row by id and reports whether it existed', async () => {
    vi.mocked(execute).mockResolvedValueOnce({ rowsAffected: 1 }).mockResolvedValueOnce({ rowsAffected: 0 })
    await expect(repository.remove(2)).resolves.toBe(true)
    await expect(repository.remove(2)).resolves.toBe(false)
    expect(execute).toHaveBeenCalledWith('DELETE FROM investments WHERE id = $1', [2])
  })
})
