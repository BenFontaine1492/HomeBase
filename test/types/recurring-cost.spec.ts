import { describe, expect, it } from 'vitest'
import type { IntervalUnit } from '@/types/maintenance-task'
import {
  costInputOfRule,
  inputOfRule,
  RecurringCostValues,
  type RecurringCost,
  type RecurringCostInput,
} from '@/types/recurring-cost'

function rule(id: number, fields: Partial<RecurringCost> = {}): RecurringCost {
  return {
    id,
    description: `Rule ${id}`,
    payee: null,
    amountCents: 40_00,
    category: null,
    paymentMethod: null,
    householdObjectId: null,
    intervalValue: 1,
    intervalUnit: 'month',
    startDate: '2026-01-31',
    endDate: null,
    nextDueDate: '2026-01-31',
    autopay: false,
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...fields,
  }
}

const input: RecurringCostInput = {
  description: ' Hausrat ',
  payee: ' Allianz ',
  amountCents: 40_00,
  category: ' Versicherungen ',
  paymentMethod: 'direct-debit',
  householdObjectId: 7,
  intervalValue: 3,
  intervalUnit: 'month',
  startDate: '2026-01-01',
  endDate: ' ',
  autopay: true,
  notes: '',
}

describe('RecurringCostValues', () => {
  it('normalises the input', () => {
    expect({ ...RecurringCostValues.from(input) }).toEqual({
      description: 'Hausrat',
      payee: 'Allianz',
      amountCents: 40_00,
      category: 'Versicherungen',
      paymentMethod: 'direct-debit',
      householdObjectId: 7,
      intervalValue: 3,
      intervalUnit: 'month',
      startDate: '2026-01-01',
      endDate: null,
      autopay: true,
      notes: null,
    })
    expect(RecurringCostValues.from({ ...input, endDate: '2026-12-31' }).endDate).toBe('2026-12-31')
  })

  it.each([
    [{ description: ' ' }, 'A cost needs a description.'],
    [{ amountCents: 0 }, 'The amount must be a positive amount.'],
    [{ amountCents: -5 }, 'The amount must be a positive amount.'],
    [{ intervalValue: 0 }, 'The interval must be a whole number from 1 to 3650.'],
    [{ intervalValue: 1.5 }, 'The interval must be a whole number from 1 to 3650.'],
    [{ intervalValue: 3651 }, 'The interval must be a whole number from 1 to 3650.'],
    [{ intervalUnit: 'decade' as IntervalUnit }, 'Unknown interval unit.'],
    [{ startDate: '2026-02-30' }, 'Enter the date of the first payment.'],
    [{ endDate: '2025-12-31' }, 'The end date must be a valid date on or after the first payment.'],
    [{ endDate: '31.12.2026' }, 'The end date must be a valid date on or after the first payment.'],
  ])('rejects %o', (change, message) => {
    expect(() => RecurringCostValues.from({ ...input, ...change })).toThrow(message)
  })

  it('turns a rule back into form input', () => {
    expect(inputOfRule(rule(1, { endDate: '2026-12-31', notes: 'n' }))).toEqual({
      description: 'Rule 1',
      payee: null,
      amountCents: 40_00,
      category: null,
      paymentMethod: null,
      householdObjectId: null,
      intervalValue: 1,
      intervalUnit: 'month',
      startDate: '2026-01-31',
      endDate: '2026-12-31',
      autopay: false,
      notes: 'n',
    })
  })
})

describe('costInputOfRule', () => {
  it('fills in a cost from a rule', () => {
    expect(costInputOfRule(rule(1, { payee: 'Allianz', category: 'Versicherungen' }), '2026-02-28')).toEqual({
      paidDate: '2026-02-28',
      amountCents: 40_00,
      category: 'Versicherungen',
      description: 'Rule 1',
      payee: 'Allianz',
      paymentMethod: null,
      notes: null,
      householdObjectId: null,
    })
  })
})
