import { describe, expect, it } from 'vitest'
import { HouseholdCategoryValues, type HouseholdCategoryInput } from '@/types/household-category'

const validInput: HouseholdCategoryInput = { name: '  Heating ', icon: 'mdi-radiator', description: ' Warm ' }

describe('HouseholdCategoryValues.from', () => {
  it('can only be created through from() (checked by the type check)', () => {
    // @ts-expect-error a plain object with the same fields is not a HouseholdCategoryValues
    const plain: HouseholdCategoryValues = { name: 'x', icon: 'mdi-radiator', description: null }
    expect(plain).not.toBeInstanceOf(HouseholdCategoryValues)
  })

  it('trims the input', () => {
    const values = HouseholdCategoryValues.from(validInput)
    expect(values).toBeInstanceOf(HouseholdCategoryValues)
    expect({ ...values }).toEqual({ name: 'Heating', icon: 'mdi-radiator', description: 'Warm' })
  })

  it('stores a missing description as null', () => {
    expect(HouseholdCategoryValues.from({ name: 'x', icon: 'mdi-radiator' }).description).toBeNull()
  })

  it.each<[string, Partial<HouseholdCategoryInput>, string]>([
    ['an empty name', { name: ' ' }, 'A category needs a name.'],
    ['an unknown icon', { icon: 'mdi-unicorn' }, 'Unknown icon "mdi-unicorn".'],
  ])('rejects %s', (_, change, message) => {
    expect(() => HouseholdCategoryValues.from({ ...validInput, ...change })).toThrow(message)
  })
})
