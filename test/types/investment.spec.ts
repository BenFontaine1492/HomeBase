import { describe, expect, it } from 'vitest'
import { InvestmentValues, type InvestmentInput } from '@/types/investment'

const validInput: InvestmentInput = { title: '  Heat pump ', description: '  Air source ', estimatedCostCents: 1_500_000, priority: 'high' }

describe('InvestmentValues.from', () => {
  it('can only be created through from() (checked by the type check)', () => {
    // @ts-expect-error a plain object with the same fields is not an InvestmentValues
    const plain: InvestmentValues = { title: 'x', description: null, estimatedCostCents: 0, priority: 'low' }
    expect(plain).not.toBeInstanceOf(InvestmentValues)
  })

  it('trims the input', () => {
    const values = InvestmentValues.from(validInput)
    expect(values).toBeInstanceOf(InvestmentValues)
    expect({ ...values }).toEqual({ title: 'Heat pump', description: 'Air source', estimatedCostCents: 1_500_000, priority: 'high' })
  })

  it('stores an empty or missing description as null', () => {
    expect(InvestmentValues.from({ ...validInput, description: '   ' }).description).toBeNull()
    expect(InvestmentValues.from({ title: 'x', estimatedCostCents: 0, priority: 'low' }).description).toBeNull()
  })

  it.each<[string, Partial<InvestmentInput>, string]>([
    ['empty title', { title: '   ' }, 'An investment needs a title.'],
    ['negative cost', { estimatedCostCents: -1 }, 'The estimated cost must be a non-negative amount.'],
    ['fractional cost', { estimatedCostCents: 1.5 }, 'The estimated cost must be a non-negative amount.'],
    ['unknown priority', { priority: 'urgent' as InvestmentInput['priority'] }, 'Unknown priority "urgent".'],
  ])('rejects %s', (_, change, message) => {
    expect(() => InvestmentValues.from({ ...validInput, ...change })).toThrow(message)
  })
})
