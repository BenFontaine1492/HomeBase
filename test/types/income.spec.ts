import { describe, expect, it } from 'vitest'
import type { PaymentMethod } from '@/types/cost'
import {
  defaultIncomeCategories,
  filterIncome,
  IncomeValues,
  incomeYearOf,
  inputOfIncome,
  sumOfIncome,
  type Income,
  type IncomeInput,
} from '@/types/income'

function income(id: number, fields: Partial<Income> = {}): Income {
  return {
    id,
    receivedDate: '2026-03-01',
    amountCents: 100_00,
    description: `Income ${id}`,
    payer: null,
    paymentMethod: null,
    category: null,
    notes: null,
    householdObjectId: null,
    recurringIncomeId: null,
    createdAt: '',
    updatedAt: '',
    ...fields,
  }
}

const input: IncomeInput = {
  receivedDate: ' 2026-01-31 ',
  amountCents: 52_10,
  description: ' Einspeisung Januar ',
  payer: ' Netzbetreiber ',
  paymentMethod: 'transfer',
  category: ' Photovoltaik ',
  notes: ' ',
  householdObjectId: 7,
}

describe('IncomeValues', () => {
  it('normalises the input', () => {
    expect({ ...IncomeValues.from(input) }).toEqual({
      receivedDate: '2026-01-31',
      amountCents: 52_10,
      description: 'Einspeisung Januar',
      payer: 'Netzbetreiber',
      paymentMethod: 'transfer',
      category: 'Photovoltaik',
      notes: null,
      householdObjectId: 7,
    })
    const minimal = IncomeValues.from({ receivedDate: '2026-01-01', amountCents: 0, description: 'x' })
    expect(minimal).toMatchObject({ payer: null, paymentMethod: null, category: null, householdObjectId: null })
  })

  it.each([
    [{ receivedDate: '2026-02-30' }, 'Enter the date it was received.'],
    [{ amountCents: -1 }, 'The amount must be a non-negative amount.'],
    [{ amountCents: 1.5 }, 'The amount must be a non-negative amount.'],
    [{ description: '  ' }, 'An income entry needs a description.'],
    [{ paymentMethod: 'cheque' as PaymentMethod }, 'Unknown payment method.'],
    [{ householdObjectId: 0 }, 'Invalid link of the cost.'],
  ])('rejects %o', (change, message) => {
    expect(() => IncomeValues.from({ ...input, ...change })).toThrow(message)
  })

  it('turns an entry back into form input', () => {
    expect(inputOfIncome(income(1, { category: 'Miete', notes: 'n', householdObjectId: 3 }))).toEqual({
      receivedDate: '2026-03-01',
      amountCents: 100_00,
      description: 'Income 1',
      payer: null,
      paymentMethod: null,
      category: 'Miete',
      notes: 'n',
      householdObjectId: 3,
    })
  })

  it('suggests the default categories, the salary first', () => {
    expect(defaultIncomeCategories()).toEqual([
      'Salary',
      'Rental income',
      'Solar power',
      'Interest and dividends',
      'Refunds',
      'Sales',
      'Other income',
    ])
  })
})

describe('years, filters and sums', () => {
  const entries = [
    income(1, { receivedDate: '2026-05-01', category: 'Photovoltaik', amountCents: 50_00 }),
    income(2, { receivedDate: '2025-12-31', category: 'Miete' }),
    income(3, { receivedDate: '2026-01-01', category: 'photovoltaik', amountCents: 25_00 }),
    income(4, { receivedDate: '2026-02-15', amountCents: 10_00 }),
  ]

  it('takes the tax year from the date received', () => {
    expect(incomeYearOf(entries[1] as Income)).toBe(2025)
  })

  it('filters by year and category', () => {
    const ids = (filter: Parameters<typeof filterIncome>[1]) => filterIncome(entries, filter).map((e) => e.id)
    expect(ids({ year: null, category: null })).toEqual([1, 2, 3, 4])
    expect(ids({ year: 2026, category: null })).toEqual([1, 3, 4])
    expect(ids({ year: null, category: 'photovoltaik' })).toEqual([1, 3])
    expect(ids({ year: null, category: '' })).toEqual([4])
  })

  it('sums the amounts', () => {
    expect(sumOfIncome(entries)).toBe(185_00)
  })
})
