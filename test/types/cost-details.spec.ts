import { describe, expect, it } from 'vitest'
import type { PaymentMethod } from '@/types/cost'
import { CostDetailsValues } from '@/types/cost-details'

describe('CostDetailsValues', () => {
  it('normalises the details; the description and the category are optional', () => {
    const values = CostDetailsValues.from({
      category: ' Wartung ',
      description: ' ',
      paymentMethod: 'cash',
      notes: ' n ',
    })
    expect({ ...values }).toEqual({ category: 'Wartung', description: null, paymentMethod: 'cash', notes: 'n' })
    expect({ ...CostDetailsValues.from({}) }).toEqual({
      category: null,
      description: null,
      paymentMethod: null,
      notes: null,
    })
  })

  it('rejects an unknown payment method', () => {
    expect(() => CostDetailsValues.from({ paymentMethod: 'cheque' as PaymentMethod })).toThrow(
      'Unknown payment method.',
    )
  })
})
