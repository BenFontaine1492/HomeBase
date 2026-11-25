import { describe, expect, it } from 'vitest'
import type { CostType } from '@/types/cost'
import { CostDetailsValues } from '@/types/cost-details'
import type { TaxCategory } from '@/types/tax-category'

const craft: TaxCategory = { id: 2, name: 'Craft', recordsLabourCost: true, sortOrder: 0, createdAt: '', updatedAt: '' }

describe('CostDetailsValues', () => {
  it('normalises the details; the description is optional', () => {
    const values = CostDetailsValues.from(
      { costType: 'repair', description: ' ', labourCents: 50, paymentMethod: 'cash', notes: ' n ', taxCategoryId: 2 },
      craft,
      100,
    )
    expect({ ...values }).toEqual({
      costType: 'repair',
      description: null,
      labourCents: 50,
      paymentMethod: 'cash',
      notes: 'n',
      taxCategoryId: 2,
    })
  })

  it('rejects an unknown type, too much labour and a deleted category', () => {
    expect(() => CostDetailsValues.from({ costType: 'x' as CostType, taxCategoryId: null }, undefined, 1)).toThrow(
      'Unknown cost type.',
    )
    expect(() => CostDetailsValues.from({ costType: 'repair', labourCents: 2, taxCategoryId: 2 }, craft, 1)).toThrow(
      'The labour cost must be a non-negative amount of at most the total.',
    )
    expect(() => CostDetailsValues.from({ costType: 'repair', taxCategoryId: 2 }, undefined, 1)).toThrow(
      'This tax category no longer exists.',
    )
  })
})
