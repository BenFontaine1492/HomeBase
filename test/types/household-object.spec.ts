import { describe, expect, it } from 'vitest'
import { HouseholdObjectValues, type HouseholdObjectInput } from '@/types/household-object'
import { HouseholdObjectAttributeValues } from '@/types/household-object-attribute'

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

describe('HouseholdObjectValues.from', () => {
  it('can only be created through from() (checked by the type check)', () => {
    const plain = { ...HouseholdObjectValues.from({ name: 'Chair', categoryId: null }, []) }
    // @ts-expect-error a plain copy is not a HouseholdObjectValues
    const copy: HouseholdObjectValues = plain
    expect(copy).not.toBeInstanceOf(HouseholdObjectValues)
  })

  it('trims the input, turns empty text into null and validates the attributes', () => {
    const values = HouseholdObjectValues.from(fullInput, [{ name: ' Power ', valueType: 'number', value: '12,5', unit: 'kW' }])
    expect(values).toBeInstanceOf(HouseholdObjectValues)
    expect({ ...values, attributes: values.attributes.map((attribute) => ({ ...attribute })) }).toEqual({
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
      attributes: [{ name: 'Power', valueType: 'number', value: '12.5', unit: 'kW' }],
    })
    expect(values.attributes[0]).toBeInstanceOf(HouseholdObjectAttributeValues)
  })

  it('accepts a minimal object without a category or attributes', () => {
    expect({ ...HouseholdObjectValues.from({ name: 'Chair', categoryId: null }, []) }).toEqual({
      name: 'Chair',
      categoryId: null,
      manufacturer: null,
      model: null,
      serialNumber: null,
      purchaseDate: null,
      purchasePriceCents: null,
      installationDate: null,
      location: null,
      notes: null,
      attributes: [],
    })
  })

  it.each<[string, Partial<HouseholdObjectInput>, string]>([
    ['an empty name', { name: '  ' }, 'An object needs a name.'],
    ['a non-integer category', { categoryId: 1.5 }, 'Invalid category.'],
    ['a negative price', { purchasePriceCents: -1 }, 'The purchase price must be a non-negative amount.'],
    ['a fractional price', { purchasePriceCents: 0.5 }, 'The purchase price must be a non-negative amount.'],
    ['a malformed purchase date', { purchaseDate: '1.1.2024' }, 'The purchase date is not a valid date.'],
    ['an impossible purchase date', { purchaseDate: '2023-02-29' }, 'The purchase date is not a valid date.'],
    ['an out-of-range installation date', { installationDate: '2024-13-45' }, 'The installation date is not a valid date.'],
  ])('rejects %s', (_, change, message) => {
    expect(() => HouseholdObjectValues.from({ ...fullInput, ...change }, [])).toThrow(message)
  })

  it('rejects invalid attributes', () => {
    expect(() => HouseholdObjectValues.from(fullInput, [{ name: ' ', valueType: 'text' }])).toThrow(
      'Every attribute needs a name.',
    )
  })
})
