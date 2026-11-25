import { describe, expect, it } from 'vitest'
import {
  availableYears,
  costTypeLabel,
  CostValues,
  filterCosts,
  inputOfCost,
  paymentMethodLabel,
  sumOfCosts,
  TAXES,
  taxGroupOf,
  taxYearOf,
  totalsByTaxCategory,
  type Cost,
  type CostInput,
  type PaymentMethod,
} from '@/types/cost'
import type { TaxCategory } from '@/types/tax-category'

function category(id: number, recordsLabourCost = false): TaxCategory {
  return { id, name: `#${id}`, recordsLabourCost, sortOrder: id, createdAt: '', updatedAt: '' }
}

const craft = category(2, true)
const donations = category(5)

const input: CostInput = {
  paidDate: ' 2026-03-02 ',
  amountCents: 500_00,
  labourCents: 300_00,
  costType: 'repair',
  description: ' Painter ',
  payee: ' Müller ',
  paymentMethod: 'transfer',
  notes: '',
  taxCategoryId: 2,
  householdObjectId: 7,
}

function cost(id: number, fields: Partial<Cost> = {}): Cost {
  return {
    id,
    paidDate: '2026-01-01',
    amountCents: 100,
    labourCents: null,
    costType: 'other',
    description: `#${id}`,
    payee: null,
    paymentMethod: null,
    notes: null,
    taxCategoryId: null,
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
    expect({ ...CostValues.from(input, craft) }).toEqual({
      paidDate: '2026-03-02',
      amountCents: 500_00,
      labourCents: 300_00,
      costType: 'repair',
      description: 'Painter',
      payee: 'Müller',
      paymentMethod: 'transfer',
      notes: null,
      taxCategoryId: 2,
      householdObjectId: 7,
      investmentId: null,
    })
  })

  it('drops the labour share unless the category records it', () => {
    expect(CostValues.from({ ...input, taxCategoryId: 5 }, donations).labourCents).toBeNull()
    expect(CostValues.from({ ...input, taxCategoryId: null }, undefined).labourCents).toBeNull()
    expect(CostValues.from({ ...input, labourCents: undefined }, craft).labourCents).toBeNull()
  })

  it('defaults the optional fields to null', () => {
    const values = CostValues.from(
      { paidDate: '2026-01-01', amountCents: 0, costType: 'other', description: 'x', taxCategoryId: null },
      undefined,
    )
    expect(values).toMatchObject({ payee: null, paymentMethod: null, householdObjectId: null, investmentId: null })
  })

  it.each([
    [{ paidDate: '2026-02-30' }, 'Enter the date it was paid.'],
    [{ amountCents: -1 }, 'The amount must be a non-negative amount.'],
    [{ amountCents: 1.5 }, 'The amount must be a non-negative amount.'],
    [{ labourCents: 500_01 }, 'The labour cost must be a non-negative amount of at most the total.'],
    [{ labourCents: -1 }, 'The labour cost must be a non-negative amount of at most the total.'],
    [{ costType: 'holiday' }, 'Unknown cost type.'],
    [{ description: '  ' }, 'A cost needs a description.'],
    [{ paymentMethod: 'cheque' as PaymentMethod }, 'Unknown payment method.'],
    [{ householdObjectId: 0 }, 'Invalid link of the cost.'],
    [{ householdObjectId: 7, investmentId: 3 }, 'A cost can be linked to an object or an investment, not both.'],
  ] as const)('rejects %o', (change, message) => {
    expect(() => CostValues.from({ ...input, ...change } as CostInput, craft)).toThrow(message)
  })

  it('keeps neither a tax category nor a labour share for taxes and fees', () => {
    // Also with a category that no longer exists: it isn't checked then.
    const tax = CostValues.from({ ...input, costType: 'tax' }, undefined)
    expect(tax).toMatchObject({ costType: 'tax', taxCategoryId: null, labourCents: null })
  })

  it('rejects a tax category that no longer exists', () => {
    expect(() => CostValues.from(input, undefined)).toThrow('This tax category no longer exists.')
  })
})

describe('inputOfCost', () => {
  it('turns a cost back into form input', () => {
    expect(inputOfCost(cost(1, { description: null, labourCents: 5, householdObjectId: 7 }))).toEqual({
      paidDate: '2026-01-01',
      amountCents: 100,
      labourCents: 5,
      costType: 'other',
      description: '',
      payee: null,
      paymentMethod: null,
      notes: null,
      taxCategoryId: null,
      householdObjectId: 7,
      investmentId: null,
    })
  })
})

describe('labels', () => {
  it('translates cost types and payment methods', () => {
    expect(costTypeLabel('repair')).toBe('Repair')
    expect(paymentMethodLabel('direct-debit')).toBe('Direct debit')
  })
})

describe('years and filters', () => {
  const costs = [
    cost(1, { paidDate: '2026-05-01', costType: 'repair', taxCategoryId: 2 }),
    cost(2, { paidDate: '2025-12-31', taxCategoryId: 5 }),
    cost(3, { paidDate: '2026-01-01' }),
    cost(4, { paidDate: '2026-02-15', costType: 'tax' }),
  ]

  it('takes the tax year from the payment date', () => {
    expect(taxYearOf(costs[1] as Cost)).toBe(2025)
    expect(availableYears(costs, 2027)).toEqual([2027, 2026, 2025])
    expect(availableYears([], 2026)).toEqual([2026])
  })

  it('filters by year, cost type and tax category', () => {
    const ids = (filter: Parameters<typeof filterCosts>[1]) => filterCosts(costs, filter).map((c) => c.id)
    expect(ids({ year: null, costType: null, taxCategoryId: null })).toEqual([1, 2, 3, 4])
    expect(ids({ year: 2026, costType: null, taxCategoryId: null })).toEqual([1, 3, 4])
    expect(ids({ year: null, costType: 'repair', taxCategoryId: null })).toEqual([1])
    expect(ids({ year: null, costType: null, taxCategoryId: 5 })).toEqual([2])
    expect(ids({ year: null, costType: null, taxCategoryId: 'none' })).toEqual([3])
    expect(ids({ year: null, costType: null, taxCategoryId: TAXES })).toEqual([4])
  })

  it('groups taxes and fees by their type, everything else by its tax category', () => {
    expect(taxGroupOf({ costType: 'tax', taxCategoryId: 2 })).toBe(TAXES)
    expect(taxGroupOf({ costType: 'repair', taxCategoryId: 2 })).toBe(2)
    expect(taxGroupOf({ costType: 'repair', taxCategoryId: null })).toBeNull()
  })
})

describe('totals', () => {
  it('sums per tax category in list order, then the taxes and fees, then the costs in neither', () => {
    const costs = [
      cost(1, { amountCents: 100, labourCents: 40, taxCategoryId: 5 }),
      cost(2, { amountCents: 200, taxCategoryId: 2 }),
      cost(3, { amountCents: 50, labourCents: 10, taxCategoryId: 2 }),
      cost(4, { amountCents: 7 }),
      cost(5, { amountCents: 3, taxCategoryId: 99 }),
      cost(6, { amountCents: 1000, costType: 'tax' }),
    ]
    expect(totalsByTaxCategory(costs, [craft, category(3), donations])).toEqual([
      { group: 2, label: '#2', count: 2, amountCents: 250, labourCents: 10 },
      { group: 5, label: '#5', count: 1, amountCents: 100, labourCents: 40 },
      { group: TAXES, label: 'Taxes and fees', count: 1, amountCents: 1000, labourCents: 0 },
      { group: null, label: 'No tax category', count: 2, amountCents: 10, labourCents: 0 },
    ])
    expect(sumOfCosts(costs)).toBe(1360)
  })
})
