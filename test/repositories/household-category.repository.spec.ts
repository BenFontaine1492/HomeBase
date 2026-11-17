import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn(), transaction: vi.fn() }))

import { execute, select, transaction } from '@/infrastructure/database'
import * as repository from '@/repositories/household-category.repository'
import { DuplicateValueError } from '@/repositories/repository-errors'
import { HouseholdCategoryValues } from '@/types/household-category'

const values = HouseholdCategoryValues.from({ name: 'Heating', icon: 'mdi-radiator', description: 'Warm' })
const uniqueViolation = 'UNIQUE constraint failed: household_categories.name'

describe('findAll', () => {
  it('maps snake_case rows to categories', async () => {
    vi.mocked(select).mockResolvedValue([
      { id: 1, name: 'Heating', icon: 'mdi-radiator', description: null, created_at: 'c', updated_at: 'u' },
    ])
    await expect(repository.findAll()).resolves.toEqual([
      { id: 1, name: 'Heating', icon: 'mdi-radiator', description: null, createdAt: 'c', updatedAt: 'u' },
    ])
  })
})

describe('insert', () => {
  it('inserts the values and returns the new id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 3 })
    await expect(repository.insert(values)).resolves.toBe(3)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO household_categories'), [
      'Heating',
      'mdi-radiator',
      'Warm',
    ])
  })

  it('reports a taken name as DuplicateValueError', async () => {
    vi.mocked(execute).mockRejectedValue(new Error(uniqueViolation))
    await expect(repository.insert(values)).rejects.toBeInstanceOf(DuplicateValueError)
  })
})

describe('update', () => {
  it('updates the row by id and reports whether it existed', async () => {
    vi.mocked(execute).mockResolvedValueOnce({ rowsAffected: 1 }).mockResolvedValueOnce({ rowsAffected: 0 })
    await expect(repository.update(5, values)).resolves.toBe(true)
    await expect(repository.update(5, values)).resolves.toBe(false)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE household_categories'), [
      'Heating',
      'mdi-radiator',
      'Warm',
      5,
    ])
  })

  it('reports a taken name as DuplicateValueError', async () => {
    vi.mocked(execute).mockRejectedValue(uniqueViolation)
    await expect(repository.update(5, values)).rejects.toBeInstanceOf(DuplicateValueError)
  })
})

describe('remove', () => {
  it('deletes the objects and the category in one transaction', async () => {
    vi.mocked(transaction).mockResolvedValue([{ rowsAffected: 4 }, { rowsAffected: 1 }])
    await expect(repository.remove(2, { deleteObjects: true })).resolves.toBe(true)
    expect(transaction).toHaveBeenCalledWith([
      { sql: 'DELETE FROM household_objects WHERE category_id = $1', params: [2] },
      { sql: 'DELETE FROM household_categories WHERE id = $1', params: [2] },
    ])
  })

  it('otherwise keeps the objects without a category', async () => {
    vi.mocked(transaction).mockResolvedValue([{ rowsAffected: 4 }, { rowsAffected: 1 }])
    await repository.remove(2, { deleteObjects: false })
    expect(vi.mocked(transaction).mock.calls[0]?.[0][0]).toEqual({
      sql: expect.stringContaining('SET category_id = NULL'),
      params: [2],
    })
  })

  it('reports a category that no longer exists', async () => {
    vi.mocked(transaction).mockResolvedValue([{ rowsAffected: 0 }, { rowsAffected: 0 }])
    await expect(repository.remove(2, { deleteObjects: false })).resolves.toBe(false)
  })
})
