import { describe, expect, it, vi } from 'vitest'

vi.mock('./database/database.service', () => ({ select: vi.fn(), execute: vi.fn() }))

import { execute, select } from './database/database.service'
import { createObject, deleteObject, listObjects, updateObject } from './household-object.service'
import type { HouseholdObjectInput } from '@/types/household-object'

const fullInput: HouseholdObjectInput = {
  name: ' Heat pump ',
  categoryId: 2,
  manufacturer: ' Acme ',
  model: 'X1',
  serialNumber: ' ',
  purchaseDate: '2024-02-29',
  purchasePriceCents: 1_000_00,
  installationDate: ' 2024-03-01 ',
  location: 'Basement',
  notes: null,
}

const fullParams = ['Heat pump', 2, 'Acme', 'X1', null, '2024-02-29', 1_000_00, '2024-03-01', 'Basement', null]

describe('listObjects', () => {
  it('maps snake_case rows to objects', async () => {
    vi.mocked(select).mockResolvedValue([
      {
        id: 1,
        name: 'Fridge',
        category_id: null,
        manufacturer: 'm',
        model: 'mo',
        serial_number: 's',
        purchase_date: '2020-01-01',
        purchase_price_cents: 5,
        installation_date: null,
        location: 'Kitchen',
        notes: 'n',
        created_at: 'c',
        updated_at: 'u',
      },
    ])
    await expect(listObjects()).resolves.toEqual([
      {
        id: 1,
        name: 'Fridge',
        categoryId: null,
        manufacturer: 'm',
        model: 'mo',
        serialNumber: 's',
        purchaseDate: '2020-01-01',
        purchasePriceCents: 5,
        installationDate: null,
        location: 'Kitchen',
        notes: 'n',
        createdAt: 'c',
        updatedAt: 'u',
      },
    ])
  })
})

describe('validation', () => {
  it.each<[string, Partial<HouseholdObjectInput>, string]>([
    ['an empty name', { name: '  ' }, 'An object needs a name.'],
    ['a non-integer category', { categoryId: 1.5 }, 'Invalid category.'],
    ['a negative price', { purchasePriceCents: -1 }, 'The purchase price must be a non-negative amount.'],
    ['a fractional price', { purchasePriceCents: 0.5 }, 'The purchase price must be a non-negative amount.'],
    ['a malformed purchase date', { purchaseDate: '1.1.2024' }, 'The purchase date is not a valid date.'],
    ['an impossible purchase date', { purchaseDate: '2023-02-29' }, 'The purchase date is not a valid date.'],
    ['an out-of-range installation date', { installationDate: '2024-13-45' }, 'The installation date is not a valid date.'],
  ])('rejects %s', async (_, change, message) => {
    await expect(createObject({ ...fullInput, ...change })).rejects.toThrow(message)
    await expect(updateObject(1, { ...fullInput, ...change })).rejects.toThrow(message)
    expect(execute).not.toHaveBeenCalled()
  })
})

describe('createObject', () => {
  it('inserts normalised values and returns the new id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 8 })
    await expect(createObject(fullInput)).resolves.toBe(8)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO household_objects'), fullParams)
  })

  it('accepts a minimal object without a category', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 })
    await createObject({ name: 'Chair', categoryId: null })
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual(['Chair', null, null, null, null, null, null, null, null, null])
  })

  it('fails when the database returns no id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(createObject(fullInput)).rejects.toThrow('The database did not return an id for the new object.')
  })

  it('turns a foreign key violation into a readable message', async () => {
    vi.mocked(execute).mockRejectedValue(new Error('FOREIGN KEY constraint failed'))
    await expect(createObject(fullInput)).rejects.toThrow('The selected category no longer exists.')
  })

  it('rethrows other database errors unchanged', async () => {
    const failure = new Error('disk full')
    vi.mocked(execute).mockRejectedValue(failure)
    await expect(createObject(fullInput)).rejects.toBe(failure)
  })
})

describe('updateObject', () => {
  it('updates the row by id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await updateObject(6, fullInput)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE household_objects'), [...fullParams, 6])
  })

  it('fails when the object no longer exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(updateObject(6, fullInput)).rejects.toThrow('This object no longer exists.')
  })

  it('turns a foreign key violation into a readable message', async () => {
    vi.mocked(execute).mockRejectedValue('FOREIGN KEY constraint failed')
    await expect(updateObject(6, fullInput)).rejects.toThrow('The selected category no longer exists.')
  })
})

describe('deleteObject', () => {
  it('deletes the row by id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await deleteObject(3)
    expect(execute).toHaveBeenCalledWith('DELETE FROM household_objects WHERE id = $1', [3])
  })

  it('fails when the object no longer exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(deleteObject(3)).rejects.toThrow('This object no longer exists.')
  })
})
