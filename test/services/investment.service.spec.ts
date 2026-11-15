import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/database/database.service', () => ({ select: vi.fn(), execute: vi.fn() }))

import { execute, select } from '@/services/database/database.service'
import {
  createInvestment,
  deleteInvestment,
  listInvestments,
  updateInvestment,
} from '@/services/investment.service'
import type { InvestmentInput } from '@/types/investment'

const validInput: InvestmentInput = { title: '  Heat pump ', description: '  Air source ', estimatedCostCents: 1_500_000, priority: 'high' }

describe('listInvestments', () => {
  it('maps snake_case rows to Investment objects', async () => {
    vi.mocked(select).mockResolvedValue([
      {
        id: 1,
        title: 'Roof',
        description: null,
        estimated_cost_cents: 100,
        priority: 'low',
        sort_order: 3,
        created_at: 'c',
        updated_at: 'u',
      },
    ])
    await expect(listInvestments()).resolves.toEqual([
      { id: 1, title: 'Roof', description: null, estimatedCostCents: 100, priority: 'low', sortOrder: 3, createdAt: 'c', updatedAt: 'u' },
    ])
  })
})

describe('validation', () => {
  it.each<[string, Partial<InvestmentInput>, string]>([
    ['empty title', { title: '   ' }, 'An investment needs a title.'],
    ['negative cost', { estimatedCostCents: -1 }, 'The estimated cost must be a non-negative amount.'],
    ['fractional cost', { estimatedCostCents: 1.5 }, 'The estimated cost must be a non-negative amount.'],
    ['unknown priority', { priority: 'urgent' as InvestmentInput['priority'] }, 'Unknown priority "urgent".'],
  ])('rejects %s before touching the database', async (_, change, message) => {
    await expect(createInvestment({ ...validInput, ...change })).rejects.toThrow(message)
    await expect(updateInvestment(1, { ...validInput, ...change })).rejects.toThrow(message)
    expect(execute).not.toHaveBeenCalled()
  })
})

describe('createInvestment', () => {
  it('inserts trimmed values and returns the new id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 9 })
    await expect(createInvestment(validInput)).resolves.toBe(9)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO investments'), [
      'Heat pump',
      'Air source',
      1_500_000,
      'high',
    ])
  })

  it('stores an empty or missing description as null', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 })
    await createInvestment({ ...validInput, description: '   ' })
    await createInvestment({ title: 'x', estimatedCostCents: 0, priority: 'low' })
    expect(vi.mocked(execute).mock.calls[0]?.[1]?.[1]).toBeNull()
    expect(vi.mocked(execute).mock.calls[1]?.[1]?.[1]).toBeNull()
  })

  it('fails when the database returns no id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(createInvestment(validInput)).rejects.toThrow('The database did not return an id for the new investment.')
  })
})

describe('updateInvestment', () => {
  it('updates the row by id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await updateInvestment(4, validInput)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE investments'), [
      'Heat pump',
      'Air source',
      1_500_000,
      'high',
      4,
    ])
  })

  it('fails when the investment no longer exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(updateInvestment(4, validInput)).rejects.toThrow('This investment no longer exists.')
  })
})

describe('deleteInvestment', () => {
  it('deletes the row by id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await deleteInvestment(2)
    expect(execute).toHaveBeenCalledWith('DELETE FROM investments WHERE id = $1', [2])
  })

  it('fails when the investment no longer exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(deleteInvestment(2)).rejects.toThrow('This investment no longer exists.')
  })
})
