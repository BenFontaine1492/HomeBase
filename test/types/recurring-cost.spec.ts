import { describe, expect, it } from 'vitest'
import type { CostType } from '@/types/cost'
import type { IntervalUnit } from '@/types/maintenance-task'
import {
  autopayRuns,
  costInputOfRule,
  dueDatesOf,
  duePayments,
  inputOfRule,
  isFinished,
  MAX_CATCH_UP,
  nextDueAfter,
  RecurringCostValues,
  type RecurringCost,
  type RecurringCostInput,
} from '@/types/recurring-cost'
import type { TaxCategory } from '@/types/tax-category'

const craft: TaxCategory = { id: 2, name: 'Craft', recordsLabourCost: true, sortOrder: 0, createdAt: '', updatedAt: '' }

function rule(id: number, fields: Partial<RecurringCost> = {}): RecurringCost {
  return {
    id,
    description: `Rule ${id}`,
    payee: null,
    amountCents: 40_00,
    labourCents: null,
    costType: 'insurance',
    taxCategoryId: null,
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
  labourCents: 10_00,
  costType: 'insurance',
  taxCategoryId: 2,
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
    expect({ ...RecurringCostValues.from(input, craft) }).toEqual({
      description: 'Hausrat',
      payee: 'Allianz',
      amountCents: 40_00,
      labourCents: 10_00,
      costType: 'insurance',
      taxCategoryId: 2,
      paymentMethod: 'direct-debit',
      householdObjectId: 7,
      intervalValue: 3,
      intervalUnit: 'month',
      startDate: '2026-01-01',
      endDate: null,
      autopay: true,
      notes: null,
    })
    expect(RecurringCostValues.from({ ...input, endDate: '2026-12-31' }, craft).endDate).toBe('2026-12-31')
  })

  it.each([
    [{ description: ' ' }, 'A cost needs a description.'],
    [{ amountCents: 0 }, 'The amount must be a positive amount.'],
    [{ amountCents: -5 }, 'The amount must be a positive amount.'],
    [{ costType: 'holiday' as CostType }, 'Unknown cost type.'],
    [{ intervalValue: 0 }, 'The interval must be a whole number from 1 to 3650.'],
    [{ intervalValue: 1.5 }, 'The interval must be a whole number from 1 to 3650.'],
    [{ intervalValue: 3651 }, 'The interval must be a whole number from 1 to 3650.'],
    [{ intervalUnit: 'decade' as IntervalUnit }, 'Unknown interval unit.'],
    [{ startDate: '2026-02-30' }, 'Enter the date of the first payment.'],
    [{ endDate: '2025-12-31' }, 'The end date must be a valid date on or after the first payment.'],
    [{ endDate: '31.12.2026' }, 'The end date must be a valid date on or after the first payment.'],
  ])('rejects %o', (change, message) => {
    expect(() => RecurringCostValues.from({ ...input, ...change }, craft)).toThrow(message)
  })

  it('turns a rule back into form input', () => {
    expect(inputOfRule(rule(1, { endDate: '2026-12-31', notes: 'n' }))).toEqual({
      description: 'Rule 1',
      payee: null,
      amountCents: 40_00,
      labourCents: null,
      costType: 'insurance',
      taxCategoryId: null,
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

describe('schedule', () => {
  it('lists the payments due up to today, keeping month ends', () => {
    expect(dueDatesOf(rule(1), '2026-04-29')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
    expect(dueDatesOf(rule(1), '2026-01-30')).toEqual([])
    expect(nextDueAfter(rule(1), '2026-01-31')).toBe('2026-02-28')
  })

  it('stops at the end date and after the catch-up limit', () => {
    const ending = rule(1, { endDate: '2026-02-28' })
    expect(dueDatesOf(ending, '2026-12-31')).toEqual(['2026-01-31', '2026-02-28'])
    expect(isFinished(ending)).toBe(false)
    expect(isFinished({ ...ending, nextDueDate: '2026-03-31' })).toBe(true)
    expect(isFinished(rule(1))).toBe(false)
    const daily = rule(2, { intervalUnit: 'day', startDate: '2025-01-01', nextDueDate: '2025-01-01' })
    expect(dueDatesOf(daily, '2026-12-31')).toHaveLength(MAX_CATCH_UP)
  })

  it('suggests the oldest due payment of each other rule, oldest first', () => {
    const rules = [
      rule(1, { startDate: '2026-03-01', nextDueDate: '2026-03-01' }),
      rule(2, { startDate: '2026-02-01', nextDueDate: '2026-02-01', autopay: true }),
      rule(3, { startDate: '2026-03-01', nextDueDate: '2026-03-01' }),
      rule(4, { startDate: '2026-01-15', nextDueDate: '2026-01-15' }),
      rule(5, { startDate: '2026-04-01', nextDueDate: '2026-04-01' }),
    ]
    const due = duePayments(rules, '2026-03-10').map(({ rule: r, dueDate, moreCount }) => [r.id, dueDate, moreCount])
    expect(due).toEqual([
      [4, '2026-01-15', 1],
      [1, '2026-03-01', 0],
      [3, '2026-03-01', 0],
    ])
  })

  it('takes payments from the start date, also when the next due date lies between two', () => {
    const edited = rule(1, { startDate: '2026-01-10', nextDueDate: '2026-02-20' })
    expect(dueDatesOf(edited, '2026-04-30')).toEqual(['2026-03-10', '2026-04-10'])
    expect(nextDueAfter(edited, '2026-02-20')).toBe('2026-03-10')
  })

  it('creates the rows of the autopay rules that are due', () => {
    const rules = [
      rule(1, { autopay: true, startDate: '2026-01-15', nextDueDate: '2026-01-15' }),
      rule(2, { autopay: true, startDate: '2026-05-01', nextDueDate: '2026-05-01' }),
      rule(3, { startDate: '2026-01-01', nextDueDate: '2026-01-01' }),
    ]
    expect(autopayRuns(rules, '2026-03-20')).toEqual([
      { rule: rules[0], dates: ['2026-01-15', '2026-02-15', '2026-03-15'], nextDueDate: '2026-04-15' },
    ])
  })

  it('fills in a cost from a rule', () => {
    expect(costInputOfRule(rule(1, { payee: 'Allianz', taxCategoryId: 3 }), '2026-02-28')).toEqual({
      paidDate: '2026-02-28',
      amountCents: 40_00,
      labourCents: null,
      costType: 'insurance',
      description: 'Rule 1',
      payee: 'Allianz',
      paymentMethod: null,
      notes: null,
      taxCategoryId: 3,
      householdObjectId: null,
    })
  })
})
