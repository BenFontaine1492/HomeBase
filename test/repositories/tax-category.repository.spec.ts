import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn(), transaction: vi.fn() }))

import { execute, select, transaction } from '@/infrastructure/database'
import { DuplicateValueError } from '@/repositories/repository-errors'
import * as repository from '@/repositories/tax-category.repository'
import { TaxCategoryValues } from '@/types/tax-category'

const values = TaxCategoryValues.from({ name: 'Spenden', recordsLabourCost: true })
const withoutLabour = TaxCategoryValues.from({ name: 'Sonstiges', recordsLabourCost: false })

describe('findAll', () => {
  it('maps rows to categories', async () => {
    vi.mocked(select).mockResolvedValue([
      { id: 1, name: 'A', records_labour_cost: 1, sort_order: 0, created_at: 'c', updated_at: 'u' },
      { id: 2, name: 'B', records_labour_cost: 0, sort_order: 1, created_at: 'c', updated_at: 'u' },
    ])
    const categories = await repository.findAll()
    expect(categories.map((category) => category.recordsLabourCost)).toEqual([true, false])
    expect(categories[0]).toEqual({
      id: 1,
      name: 'A',
      recordsLabourCost: true,
      sortOrder: 0,
      createdAt: 'c',
      updatedAt: 'u',
    })
  })
})

describe('writes', () => {
  it('inserts at the end of the list and returns the id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 3 })
    await expect(repository.insert(values)).resolves.toBe(3)
    const [sql, params] = vi.mocked(execute).mock.calls[0] ?? []
    expect(sql).toContain('max(sort_order)')
    expect(params).toEqual(['Spenden', 1])
    await repository.insert(withoutLabour)
    expect(vi.mocked(execute).mock.calls[1]?.[1]).toEqual(['Sonstiges', 0])
  })

  it('reports a name in use as DuplicateValueError', async () => {
    vi.mocked(execute).mockRejectedValue(new Error('UNIQUE constraint failed'))
    await expect(repository.insert(values)).rejects.toBeInstanceOf(DuplicateValueError)
    await expect(repository.update(3, values)).rejects.toBeInstanceOf(DuplicateValueError)
  })

  it('inserts several categories in one transaction, skipping names in use', async () => {
    const other = TaxCategoryValues.from({ name: 'Sonstiges', recordsLabourCost: false })
    vi.mocked(transaction).mockResolvedValue([])
    await repository.insertAll([values, other])
    const statements = vi.mocked(transaction).mock.calls[0]?.[0] ?? []
    expect(statements.map((statement) => statement.params)).toEqual([
      ['Spenden', 1],
      ['Sonstiges', 0],
    ])
    expect(statements[0]?.sql).toContain('ON CONFLICT (name) DO NOTHING')
  })

  it('updates and deletes, reporting whether the category exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.update(3, values)).resolves.toBe(true)
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual(['Spenden', 1, 3])
    await repository.update(3, withoutLabour)
    expect(vi.mocked(execute).mock.calls[1]?.[1]).toEqual(['Sonstiges', 0, 3])
    await expect(repository.remove(3)).resolves.toBe(true)
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(repository.update(3, values)).resolves.toBe(false)
    await expect(repository.remove(3)).resolves.toBe(false)
  })
})
