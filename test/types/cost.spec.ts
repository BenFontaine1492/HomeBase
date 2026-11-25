import { describe, expect, it } from 'vitest'
import {
  availableYears,
  costCategoryName,
  CostValues,
  defaultCostCategories,
  filterCosts,
  inputOfCost,
  paymentMethodLabel,
  sumOfCosts,
  taxYearOf,
  type Cost,
  type CostInput,
  type PaymentMethod,
} from '@/types/cost'

const input: CostInput = {
  paidDate: ' 2026-03-02 ',
  amountCents: 500_00,
  category: ' Handwerkerleistungen ',
  description: ' Painter ',
  payee: ' Müller ',
  paymentMethod: 'transfer',
  notes: '',
  householdObjectId: 7,
}

function cost(id: number, fields: Partial<Cost> = {}): Cost {
  return {
    id,
    paidDate: '2026-01-01',
    amountCents: 100,
    category: null,
    description: `#${id}`,
    payee: null,
    paymentMethod: null,
    notes: null,
    householdObjectId: null,
    maintenanceRecordId: null,
    investmentId: null,
    recurringCostId: null,
    objectId: null,
    createdAt: '',
    updatedAt: '',
    ...fields,
  }
}

describe('CostValues', () => {
  it('trims and normalises the input', () => {
    expect({ ...CostValues.from(input) }).toEqual({
      paidDate: '2026-03-02',
      amountCents: 500_00,
      category: 'Handwerkerleistungen',
      description: 'Painter',
      payee: 'Müller',
      paymentMethod: 'transfer',
      notes: null,
      householdObjectId: 7,
      investmentId: null,
    })
  })

  it('defaults the optional fields to null', () => {
    const values = CostValues.from({ paidDate: '2026-01-01', amountCents: 0, description: 'x' })
    expect(values).toMatchObject({
      category: null,
      payee: null,
      paymentMethod: null,
      householdObjectId: null,
      investmentId: null,
    })
  })

  it.each([
    [{ paidDate: '2026-02-30' }, 'Enter the date it was paid.'],
    [{ amountCents: -1 }, 'The amount must be a non-negative amount.'],
    [{ amountCents: 1.5 }, 'The amount must be a non-negative amount.'],
    [{ description: '  ' }, 'A cost needs a description.'],
    [{ paymentMethod: 'cheque' as PaymentMethod }, 'Unknown payment method.'],
    [{ householdObjectId: 0 }, 'Invalid link of the cost.'],
    [{ householdObjectId: 7, investmentId: 3 }, 'A cost can be linked to an object or an investment, not both.'],
  ] as const)('rejects %o', (change, message) => {
    expect(() => CostValues.from({ ...input, ...change })).toThrow(message)
  })
})

describe('inputOfCost', () => {
  it('turns a cost back into form input', () => {
    expect(inputOfCost(cost(1, { description: null, category: 'Wartung', householdObjectId: 7 }))).toEqual({
      paidDate: '2026-01-01',
      amountCents: 100,
      category: 'Wartung',
      description: '',
      payee: null,
      paymentMethod: null,
      notes: null,
      householdObjectId: 7,
      investmentId: null,
    })
  })
})

describe('labels', () => {
  it('translates payment methods and the default categories', () => {
    expect(paymentMethodLabel('direct-debit')).toBe('Direct debit')
    expect(costCategoryName('maintenance')).toBe('Maintenance')
    expect(defaultCostCategories()).toContain('Tradesman services')
    expect(defaultCostCategories()).toHaveLength(16)
  })
})

describe('years and filters', () => {
  const costs = [
    cost(1, { paidDate: '2026-05-01', category: 'Reparatur' }),
    cost(2, { paidDate: '2025-12-31', category: 'Spenden' }),
    cost(3, { paidDate: '2026-01-01' }),
    cost(4, { paidDate: '2026-02-15', category: 'reparatur' }),
  ]

  it('takes the tax year from the payment date', () => {
    expect(taxYearOf(costs[1] as Cost)).toBe(2025)
    expect(
      availableYears(
        costs.map((c) => c.paidDate),
        2027,
      ),
    ).toEqual([2027, 2026, 2025])
    expect(availableYears([], 2026)).toEqual([2026])
  })

  it('filters by year and category', () => {
    const ids = (filter: Parameters<typeof filterCosts>[1]) => filterCosts(costs, filter).map((c) => c.id)
    expect(ids({ year: null, category: null })).toEqual([1, 2, 3, 4])
    expect(ids({ year: 2026, category: null })).toEqual([1, 3, 4])
    expect(ids({ year: null, category: 'reparatur' })).toEqual([1, 4])
    expect(ids({ year: null, category: '' })).toEqual([3])
  })

  it('sums the amounts', () => {
    expect(sumOfCosts(costs)).toBe(400)
  })
})
