import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn() }))

import { execute, select } from '@/infrastructure/database'
import * as repository from '@/repositories/investment.repository'
import { InvestmentValues } from '@/types/investment'

const values = InvestmentValues.from({ title: 'Heat pump', estimatedCostCents: 1_500_000, priority: 'high' })

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
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('COALESCE(MAX(sort_order), 0) + 1'), [
      'Heat pump',
      null,
      1_500_000,
      'high',
    ])
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
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE investments'), [
      'Heat pump',
      null,
      1_500_000,
      'high',
      4,
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
