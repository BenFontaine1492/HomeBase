import { describe, expect, it } from 'vitest'
import { DEFAULT_TAX_CATEGORIES, TaxCategoryValues } from '@/types/tax-category'

describe('TaxCategoryValues', () => {
  it('trims the name and keeps the labour switch', () => {
    expect({ ...TaxCategoryValues.from({ name: '  Spenden ', recordsLabourCost: true }) }).toEqual({
      name: 'Spenden',
      recordsLabourCost: true,
    })
  })

  it('needs a name', () => {
    expect(() => TaxCategoryValues.from({ name: '  ', recordsLabourCost: false })).toThrow(
      'A tax category needs a name.',
    )
  })
})

describe('DEFAULT_TAX_CATEGORIES', () => {
  it('are valid, unique and record labour costs for the §35a categories only', () => {
    const names = DEFAULT_TAX_CATEGORIES.map((input) => TaxCategoryValues.from(input).name)
    expect(new Set(names).size).toBe(names.length)
    expect(DEFAULT_TAX_CATEGORIES.filter((input) => input.recordsLabourCost).map((input) => input.name)).toEqual([
      'Haushaltsnahe Dienstleistungen',
      'Handwerkerleistungen',
    ])
  })
})
