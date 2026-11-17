import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/household-object.repository', () => ({
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

import * as repository from '@/repositories/household-object.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import { createObject, deleteObject, listObjects, updateObject } from '@/services/household-object.service'
import { HouseholdObjectValues, type HouseholdObjectInput } from '@/types/household-object'

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

const fullValues = {
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

const power = { name: ' Power ', valueType: 'number', value: '12,5', unit: 'kW' } as const
const powerValues = { name: 'Power', valueType: 'number', value: '12.5', unit: 'kW' }
const fullValuesWithPower = { ...fullValues, attributes: [powerValues] }
const missingReference = new MissingReferenceError('FOREIGN KEY constraint failed')

describe('listObjects', () => {
  it('returns the objects from the repository', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([])
    await expect(listObjects()).resolves.toEqual([])
  })
})

describe('createObject', () => {
  it('stores normalised values and attributes and returns the new id', async () => {
    vi.mocked(repository.insert).mockResolvedValue(8)
    await expect(createObject(fullInput, [power])).resolves.toBe(8)
    expect(repository.insert).toHaveBeenCalledWith(fullValuesWithPower)
    expect(vi.mocked(repository.insert).mock.calls[0]?.[0]).toBeInstanceOf(HouseholdObjectValues)
  })

  it('rejects invalid input or attributes without touching the database', async () => {
    await expect(createObject({ ...fullInput, name: ' ' }, [])).rejects.toThrow('An object needs a name.')
    await expect(updateObject(1, fullInput, [{ ...power, value: 'many' }])).rejects.toThrow('"Power" must be a number.')
    expect(repository.insert).not.toHaveBeenCalled()
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('turns a missing category into a readable message', async () => {
    vi.mocked(repository.insert).mockRejectedValue(missingReference)
    await expect(createObject(fullInput, [])).rejects.toThrow('The selected category no longer exists.')
  })

  it('rethrows other errors unchanged', async () => {
    const failure = new Error('disk full')
    vi.mocked(repository.insert).mockRejectedValue(failure)
    await expect(createObject(fullInput, [])).rejects.toBe(failure)
  })
})

describe('updateObject', () => {
  it('updates the object and replaces its attributes', async () => {
    vi.mocked(repository.update).mockResolvedValue(true)
    await updateObject(6, fullInput, [power])
    expect(repository.update).toHaveBeenCalledWith(6, fullValuesWithPower)
  })

  it('fails when the object no longer exists', async () => {
    vi.mocked(repository.update).mockResolvedValue(false)
    await expect(updateObject(6, fullInput, [])).rejects.toThrow('This object no longer exists.')
  })

  it('turns a missing reference into a readable message', async () => {
    vi.mocked(repository.update).mockRejectedValue(missingReference)
    await expect(updateObject(6, fullInput, [power])).rejects.toThrow('This object or its category no longer exists.')
  })
})

describe('deleteObject', () => {
  it('deletes the object by id', async () => {
    vi.mocked(repository.remove).mockResolvedValue(true)
    await deleteObject(3)
    expect(repository.remove).toHaveBeenCalledWith(3)
  })

  it('fails when the object no longer exists', async () => {
    vi.mocked(repository.remove).mockResolvedValue(false)
    await expect(deleteObject(3)).rejects.toThrow('This object no longer exists.')
  })
})
