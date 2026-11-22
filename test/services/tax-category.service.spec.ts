import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/tax-category.repository', () => ({
  findAll: vi.fn(),
  insert: vi.fn(),
  insertAll: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

import { DuplicateValueError } from '@/repositories/repository-errors'
import * as repository from '@/repositories/tax-category.repository'
import * as service from '@/services/tax-category.service'
import { DEFAULT_TAX_CATEGORIES, TaxCategoryValues } from '@/types/tax-category'

const input = { name: ' Spenden ', recordsLabourCost: false }
const duplicate = new DuplicateValueError('UNIQUE constraint failed')

describe('tax categories', () => {
  it('lists the categories', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([])
    await expect(service.listTaxCategories()).resolves.toEqual([])
  })

  it('creates a category from validated values', async () => {
    vi.mocked(repository.insert).mockResolvedValue(4)
    await expect(service.createTaxCategory(input)).resolves.toBe(4)
    const values = vi.mocked(repository.insert).mock.calls[0]?.[0]
    expect(values).toBeInstanceOf(TaxCategoryValues)
    expect(values?.name).toBe('Spenden')
  })

  it('reports a name in use', async () => {
    vi.mocked(repository.insert).mockRejectedValue(duplicate)
    await expect(service.createTaxCategory(input)).rejects.toThrow('A tax category with this name already exists.')
    vi.mocked(repository.update).mockRejectedValue(duplicate)
    await expect(service.updateTaxCategory(4, input)).rejects.toThrow('A tax category with this name already exists.')
  })

  it('updates and deletes, or reports a deleted category', async () => {
    vi.mocked(repository.update).mockResolvedValue(true)
    await service.updateTaxCategory(4, input)
    vi.mocked(repository.update).mockResolvedValue(false)
    await expect(service.updateTaxCategory(4, input)).rejects.toThrow('This tax category no longer exists.')
    vi.mocked(repository.remove).mockResolvedValue(true)
    await service.deleteTaxCategory(4)
    vi.mocked(repository.remove).mockResolvedValue(false)
    await expect(service.deleteTaxCategory(4)).rejects.toThrow('This tax category no longer exists.')
  })

  it('adds the default categories in one call', async () => {
    vi.mocked(repository.insertAll).mockResolvedValue()
    await service.addDefaultTaxCategories()
    const list = vi.mocked(repository.insertAll).mock.calls[0]?.[0] ?? []
    expect(list.map((values) => values.name)).toEqual(DEFAULT_TAX_CATEGORIES.map((category) => category.name))
  })
})
