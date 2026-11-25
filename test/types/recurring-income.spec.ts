import { describe, expect, it } from 'vitest'
import type { IntervalUnit } from '@/types/maintenance-task'
import {
  incomeInputOfRule,
  inputOfIncomeRule,
  RecurringIncomeValues,
  type RecurringIncome,
  type RecurringIncomeInput,
} from '@/types/recurring-income'

function rule(id: number, fields: Partial<RecurringIncome> = {}): RecurringIncome {
  return {
    id,
    description: `Rule ${id}`,
    payer: null,
    amountCents: 800_00,
    category: null,
    paymentMethod: null,
    householdObjectId: null,
    intervalValue: 1,
    intervalUnit: 'month',
    startDate: '2026-01-01',
    endDate: null,
    nextDueDate: '2026-01-01',
    autopay: false,
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...fields,
  }
}

const input: RecurringIncomeInput = {
  description: ' Miete DG ',
  payer: ' Familie Weber ',
  amountCents: 800_00,
  category: ' Vermietung und Verpachtung ',
  paymentMethod: 'transfer',
  householdObjectId: 4,
  intervalValue: 1,
  intervalUnit: 'month',
  startDate: '2026-01-01',
  endDate: ' ',
  autopay: true,
  notes: '',
}

describe('RecurringIncomeValues', () => {
  it('normalises the input', () => {
    expect({ ...RecurringIncomeValues.from(input) }).toEqual({
      description: 'Miete DG',
      payer: 'Familie Weber',
      amountCents: 800_00,
      category: 'Vermietung und Verpachtung',
      paymentMethod: 'transfer',
      householdObjectId: 4,
      intervalValue: 1,
      intervalUnit: 'month',
      startDate: '2026-01-01',
      endDate: null,
      autopay: true,
      notes: null,
    })
  })

  it.each([
    [{ description: ' ' }, 'An income entry needs a description.'],
    [{ amountCents: 0 }, 'The amount must be a positive amount.'],
    [{ amountCents: -5 }, 'The amount must be a positive amount.'],
    [{ intervalValue: 0 }, 'The interval must be a whole number from 1 to 3650.'],
    [{ intervalUnit: 'decade' as IntervalUnit }, 'Unknown interval unit.'],
    [{ startDate: '2026-02-30' }, 'Enter the date of the first payment.'],
    [{ endDate: '2025-12-31' }, 'The end date must be a valid date on or after the first payment.'],
  ])('rejects %o', (change, message) => {
    expect(() => RecurringIncomeValues.from({ ...input, ...change })).toThrow(message)
  })

  it('turns a rule back into form input', () => {
    expect(inputOfIncomeRule(rule(1, { endDate: '2026-12-31', category: 'Miete' }))).toEqual({
      description: 'Rule 1',
      payer: null,
      amountCents: 800_00,
      category: 'Miete',
      paymentMethod: null,
      householdObjectId: null,
      intervalValue: 1,
      intervalUnit: 'month',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      autopay: false,
      notes: null,
    })
  })

  it('fills in an income entry from a rule', () => {
    expect(incomeInputOfRule(rule(1, { payer: 'Weber', category: 'Miete', notes: 'n' }), '2026-02-01')).toEqual({
      receivedDate: '2026-02-01',
      amountCents: 800_00,
      description: 'Rule 1',
      payer: 'Weber',
      paymentMethod: null,
      category: 'Miete',
      notes: null,
      householdObjectId: null,
    })
  })
})
