import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn(), transaction: vi.fn() }))

import { execute, select, transaction } from '@/infrastructure/database'
import * as repository from '@/repositories/household-object.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import { HouseholdObjectValues, type HouseholdObjectInput } from '@/types/household-object'

const input: HouseholdObjectInput = {
  name: 'Heat pump',
  categoryId: 2,
  manufacturer: 'Acme',
  model: 'X1',
  serialNumber: null,
  purchaseDate: '2024-02-29',
  purchasePriceCents: 1_000_00,
  installationDate: '2024-03-01',
  location: 'Basement',
  notes: null,
}
const params = ['Heat pump', 2, 'Acme', 'X1', null, '2024-02-29', 1_000_00, '2024-03-01', 'Basement', null]
const power = { name: 'Power', valueType: 'number', value: '12.5', unit: 'kW' } as const
const values = HouseholdObjectValues.from(input, [])
const valuesWithPower = HouseholdObjectValues.from(input, [power])

/** The statements of the last transaction. */
function statements() {
  return vi.mocked(transaction).mock.calls.at(-1)?.[0] ?? []
}

describe('findAll', () => {
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
    await expect(repository.findAll()).resolves.toEqual([
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

describe('insert', () => {
  it('inserts the object and its attributes in one transaction and returns the new id', async () => {
    vi.mocked(transaction).mockResolvedValue([
      { rowsAffected: 1, lastInsertId: 8 },
      { rowsAffected: 1, lastInsertId: 1 },
    ])
    await expect(repository.insert(valuesWithPower)).resolves.toBe(8)

    const [object, attribute] = statements()
    expect(object).toEqual({ sql: expect.stringContaining('INSERT INTO household_objects'), params })
    // The attribute refers to the object inserted just before it.
    expect(attribute?.sql).toContain('(SELECT max(id) FROM household_objects)')
    expect(attribute?.params).toEqual(['Power', 'number', '12.5', 'kW', 0])
    expect(statements()).toHaveLength(2)
  })

  it('fails when the database returns no id', async () => {
    vi.mocked(transaction).mockResolvedValue([])
    await expect(repository.insert(values)).rejects.toThrow('The database did not return an id for the new object.')
  })

  it('reports a missing category as MissingReferenceError', async () => {
    vi.mocked(transaction).mockRejectedValue(new Error('FOREIGN KEY constraint failed'))
    await expect(repository.insert(values)).rejects.toBeInstanceOf(MissingReferenceError)
  })
})

describe('update', () => {
  it('updates the row and replaces its attributes in one transaction', async () => {
    vi.mocked(transaction).mockResolvedValue([{ rowsAffected: 1 }, { rowsAffected: 3 }, { rowsAffected: 1 }])
    await expect(repository.update(6, valuesWithPower)).resolves.toBe(true)

    const [object, removal, attribute] = statements()
    expect(object).toEqual({ sql: expect.stringContaining('UPDATE household_objects'), params: [...params, 6] })
    expect(removal).toEqual({ sql: expect.stringContaining('DELETE FROM household_object_attributes'), params: [6] })
    expect(attribute?.params).toEqual(['Power', 'number', '12.5', 'kW', 0, 6])
  })

  it('reports an object that no longer exists', async () => {
    vi.mocked(transaction).mockResolvedValue([{ rowsAffected: 0 }, { rowsAffected: 0 }])
    await expect(repository.update(6, values)).resolves.toBe(false)
  })

  it('reports a missing category or object as MissingReferenceError', async () => {
    vi.mocked(transaction).mockRejectedValue('FOREIGN KEY constraint failed')
    await expect(repository.update(6, valuesWithPower)).rejects.toBeInstanceOf(MissingReferenceError)
  })
})

describe('remove', () => {
  it('deletes the row by id and reports whether it existed', async () => {
    vi.mocked(execute).mockResolvedValueOnce({ rowsAffected: 1 }).mockResolvedValueOnce({ rowsAffected: 0 })
    await expect(repository.remove(3)).resolves.toBe(true)
    await expect(repository.remove(3)).resolves.toBe(false)
    expect(execute).toHaveBeenCalledWith('DELETE FROM household_objects WHERE id = $1', [3])
  })
})
