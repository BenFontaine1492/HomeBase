import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/household-category.repository', () => ({
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

import * as repository from '@/repositories/household-category.repository'
import { DuplicateValueError } from '@/repositories/repository-errors'
import { createCategory, deleteCategory, listCategories, updateCategory } from '@/services/household-category.service'
import { HouseholdCategoryValues, type HouseholdCategoryInput } from '@/types/household-category'

const validInput: HouseholdCategoryInput = { name: '  Heating ', icon: 'mdi-radiator', description: ' Warm ' }
const validValues = { name: 'Heating', icon: 'mdi-radiator', description: 'Warm' }
const duplicate = new DuplicateValueError('UNIQUE constraint failed: household_categories.name')

describe('listCategories', () => {
  it('returns the categories from the repository', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([])
    await expect(listCategories()).resolves.toEqual([])
  })
})

describe('createCategory', () => {
  it('stores trimmed values and returns the new id', async () => {
    vi.mocked(repository.insert).mockResolvedValue(3)
    await expect(createCategory(validInput)).resolves.toBe(3)
    expect(repository.insert).toHaveBeenCalledWith(validValues)
  })

  it('passes a validated value object to the repository', async () => {
    vi.mocked(repository.insert).mockResolvedValue(3)
    await createCategory(validInput)
    expect(vi.mocked(repository.insert).mock.calls[0]?.[0]).toBeInstanceOf(HouseholdCategoryValues)
  })

  it('rejects invalid input without touching the database', async () => {
    await expect(createCategory({ ...validInput, name: ' ' })).rejects.toThrow('A category needs a name.')
    await expect(updateCategory(1, { ...validInput, name: ' ' })).rejects.toThrow('A category needs a name.')
    expect(repository.insert).not.toHaveBeenCalled()
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('turns a duplicate name into a readable message', async () => {
    vi.mocked(repository.insert).mockRejectedValue(duplicate)
    await expect(createCategory(validInput)).rejects.toThrow('A category with this name already exists.')
  })

  it('rethrows other errors unchanged', async () => {
    const failure = new Error('disk full')
    vi.mocked(repository.insert).mockRejectedValue(failure)
    await expect(createCategory(validInput)).rejects.toBe(failure)
  })
})

describe('updateCategory', () => {
  it('updates the category by id', async () => {
    vi.mocked(repository.update).mockResolvedValue(true)
    await updateCategory(5, validInput)
    expect(repository.update).toHaveBeenCalledWith(5, validValues)
  })

  it('fails when the category no longer exists', async () => {
    vi.mocked(repository.update).mockResolvedValue(false)
    await expect(updateCategory(5, validInput)).rejects.toThrow('This category no longer exists.')
  })

  it('turns a duplicate name into a readable message', async () => {
    vi.mocked(repository.update).mockRejectedValue(duplicate)
    await expect(updateCategory(5, validInput)).rejects.toThrow('A category with this name already exists.')
  })
})

describe('deleteCategory', () => {
  it('passes the choice about the objects on', async () => {
    vi.mocked(repository.remove).mockResolvedValue(true)
    await deleteCategory(2, { deleteObjects: true })
    expect(repository.remove).toHaveBeenCalledWith(2, { deleteObjects: true })
  })

  it('fails when the category no longer exists', async () => {
    vi.mocked(repository.remove).mockResolvedValue(false)
    await expect(deleteCategory(2, { deleteObjects: false })).rejects.toThrow('This category no longer exists.')
  })
})
