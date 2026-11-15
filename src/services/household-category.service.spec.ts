import { describe, expect, it, vi } from 'vitest'

vi.mock('./database/database.service', () => ({ select: vi.fn(), execute: vi.fn() }))

import { execute, select } from './database/database.service'
import { createCategory, deleteCategory, listCategories, updateCategory } from './household-category.service'
import type { HouseholdCategoryInput } from '@/types/household-category'

const validInput: HouseholdCategoryInput = { name: '  Heating ', icon: 'mdi-radiator', description: ' Warm ' }
const uniqueViolation = 'UNIQUE constraint failed: household_categories.name'

describe('listCategories', () => {
  it('maps snake_case rows to categories', async () => {
    vi.mocked(select).mockResolvedValue([
      { id: 1, name: 'Heating', icon: 'mdi-radiator', description: null, created_at: 'c', updated_at: 'u' },
    ])
    await expect(listCategories()).resolves.toEqual([
      { id: 1, name: 'Heating', icon: 'mdi-radiator', description: null, createdAt: 'c', updatedAt: 'u' },
    ])
  })
})

describe('validation', () => {
  it.each<[string, Partial<HouseholdCategoryInput>, string]>([
    ['an empty name', { name: ' ' }, 'A category needs a name.'],
    ['an unknown icon', { icon: 'mdi-unicorn' }, 'Unknown icon "mdi-unicorn".'],
  ])('rejects %s', async (_, change, message) => {
    await expect(createCategory({ ...validInput, ...change })).rejects.toThrow(message)
    await expect(updateCategory(1, { ...validInput, ...change })).rejects.toThrow(message)
    expect(execute).not.toHaveBeenCalled()
  })
})

describe('createCategory', () => {
  it('inserts trimmed values and returns the new id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 3 })
    await expect(createCategory(validInput)).resolves.toBe(3)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO household_categories'), [
      'Heating',
      'mdi-radiator',
      'Warm',
    ])
  })

  it('stores a missing description as null', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 3 })
    await createCategory({ name: 'x', icon: 'mdi-radiator' })
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual(['x', 'mdi-radiator', null])
  })

  it('fails when the database returns no id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(createCategory(validInput)).rejects.toThrow('The database did not return an id for the new category.')
  })

  it('turns a duplicate name into a readable message', async () => {
    vi.mocked(execute).mockRejectedValue(new Error(uniqueViolation))
    await expect(createCategory(validInput)).rejects.toThrow('A category with this name already exists.')
  })

  it('rethrows other database errors unchanged', async () => {
    const failure = new Error('disk full')
    vi.mocked(execute).mockRejectedValue(failure)
    await expect(createCategory(validInput)).rejects.toBe(failure)
  })
})

describe('updateCategory', () => {
  it('updates the row by id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await updateCategory(5, validInput)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE household_categories'), [
      'Heating',
      'mdi-radiator',
      'Warm',
      5,
    ])
  })

  it('fails when the category no longer exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(updateCategory(5, validInput)).rejects.toThrow('This category no longer exists.')
  })

  it('turns a duplicate name into a readable message', async () => {
    vi.mocked(execute).mockRejectedValue(uniqueViolation)
    await expect(updateCategory(5, validInput)).rejects.toThrow('A category with this name already exists.')
  })
})

describe('deleteCategory', () => {
  it('deletes the objects first when asked to', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await deleteCategory(2, { deleteObjects: true })
    expect(execute).toHaveBeenNthCalledWith(1, 'DELETE FROM household_objects WHERE category_id = $1', [2])
    expect(execute).toHaveBeenNthCalledWith(2, 'DELETE FROM household_categories WHERE id = $1', [2])
  })

  it('otherwise keeps the objects without a category', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await deleteCategory(2, { deleteObjects: false })
    expect(execute).toHaveBeenNthCalledWith(1, expect.stringContaining('SET category_id = NULL'), [2])
    expect(execute).toHaveBeenNthCalledWith(2, 'DELETE FROM household_categories WHERE id = $1', [2])
  })

  it('fails when the category no longer exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(deleteCategory(2, { deleteObjects: false })).rejects.toThrow('This category no longer exists.')
  })
})
