import { describe, expect, it } from 'vitest'
import { HouseholdObjectAttributeValues, type HouseholdObjectAttributeInput } from '@/types/household-object-attribute'

/** Plain copies, so results can be compared with object literals. */
function plain(values: readonly HouseholdObjectAttributeValues[]) {
  return values.map((value) => ({ ...value }))
}

describe('HouseholdObjectAttributeValues.normaliseNumber', () => {
  it.each([
    ['12', '12'],
    [' 12,5 ', '12.5'],
    ['-0.25', '-0.25'],
  ])('accepts %j', (input, expected) => {
    expect(HouseholdObjectAttributeValues.normaliseNumber(input)).toBe(expected)
  })

  it.each(['', 'abc', '12 kW', '1.2.3', '1e3', '.5', '1,000.5'])('rejects %j', (input) => {
    expect(HouseholdObjectAttributeValues.normaliseNumber(input)).toBeNull()
  })
})

describe('HouseholdObjectAttributeValues.listFrom', () => {
  it('can only be created through from() / listFrom() (checked by the type check)', () => {
    // @ts-expect-error a plain object with the same fields is not a HouseholdObjectAttributeValues
    const lookalike: HouseholdObjectAttributeValues = { name: 'x', valueType: 'text', value: null, unit: null }
    expect(lookalike).not.toBeInstanceOf(HouseholdObjectAttributeValues)
  })

  it('trims names and stores each type in canonical form', () => {
    const values = HouseholdObjectAttributeValues.listFrom([
      { name: ' Refrigerant ', valueType: 'text', value: ' R290 ', unit: 'ignored' },
      { name: 'Power', valueType: 'number', value: ' -12,5 ', unit: ' kW ' },
      { name: 'Flow', valueType: 'number', value: '3', unit: ' ' },
      { name: 'Serviced', valueType: 'date', value: '2026-03-04' },
      { name: 'Warranty', valueType: 'boolean', value: '1' },
      { name: 'Smart', valueType: 'boolean', value: '0' },
      { name: 'Filter', valueType: 'text', value: '  ' },
      { name: 'Size', valueType: 'number' },
    ])
    expect(values[0]).toBeInstanceOf(HouseholdObjectAttributeValues)
    expect(plain(values)).toEqual([
      { name: 'Refrigerant', valueType: 'text', value: 'R290', unit: null },
      { name: 'Power', valueType: 'number', value: '-12.5', unit: 'kW' },
      { name: 'Flow', valueType: 'number', value: '3', unit: null },
      { name: 'Serviced', valueType: 'date', value: '2026-03-04', unit: null },
      { name: 'Warranty', valueType: 'boolean', value: '1', unit: null },
      { name: 'Smart', valueType: 'boolean', value: '0', unit: null },
      { name: 'Filter', valueType: 'text', value: null, unit: null },
      { name: 'Size', valueType: 'number', value: null, unit: null },
    ])
  })

  it.each<[string, HouseholdObjectAttributeInput[], string]>([
    ['an empty name', [{ name: ' ', valueType: 'text' }], 'Every attribute needs a name.'],
    [
      'a name used twice (ignoring case)',
      [
        { name: 'Power', valueType: 'text' },
        { name: ' power ', valueType: 'number' },
      ],
      'The attribute "power" is listed twice.',
    ],
    ['an unknown type', [{ name: 'Colour', valueType: 'colour' as 'text' }], '"Colour" has an unknown type.'],
    ['a number that is not one', [{ name: 'Power', valueType: 'number', value: '12 kW' }], '"Power" must be a number.'],
    [
      'an impossible date',
      [{ name: 'Serviced', valueType: 'date', value: '2023-02-29' }],
      '"Serviced" is not a valid date.',
    ],
    [
      'a boolean that is not 1/0',
      [{ name: 'Smart', valueType: 'boolean', value: 'yes' }],
      '"Smart" must be yes or no.',
    ],
  ])('rejects %s', (_, inputs, message) => {
    expect(() => HouseholdObjectAttributeValues.listFrom(inputs)).toThrow(message)
  })
})
