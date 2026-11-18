import { describe, expect, it } from 'vitest'
import {
  InvestmentOrder,
  InvestmentValues,
  investmentInputOf,
  isOverBudget,
  movedOrder,
  plannedInvestments,
  priorityLabel,
  purchasedInvestments,
  savingsProgress,
  statusLabel,
  type Investment,
  type InvestmentInput,
} from '@/types/investment'

const validInput: InvestmentInput = {
  title: '  Heat pump ',
  description: '  Air source ',
  estimatedCostCents: 1_500_000,
  priority: 'high',
}

function investment(changes: Partial<Investment> = {}): Investment {
  return {
    id: 1,
    title: 'Roof',
    description: null,
    estimatedCostCents: 100_000,
    priority: 'medium',
    sortOrder: 1,
    status: 'planned',
    purchasedDate: null,
    targetDate: null,
    budgetCents: null,
    savedCents: null,
    createdAt: '',
    updatedAt: '',
    ...changes,
  }
}

describe('InvestmentValues.from', () => {
  it('can only be created through from() (checked by the type check)', () => {
    // @ts-expect-error a plain object with the same fields is not an InvestmentValues
    const plain: InvestmentValues = { title: 'x', description: null, estimatedCostCents: 0, priority: 'low' }
    expect(plain).not.toBeInstanceOf(InvestmentValues)
  })

  it('trims the input; a new investment is planned, without dates and amounts', () => {
    const values = InvestmentValues.from(validInput)
    expect(values).toBeInstanceOf(InvestmentValues)
    expect({ ...values }).toEqual({
      title: 'Heat pump',
      description: 'Air source',
      estimatedCostCents: 1_500_000,
      priority: 'high',
      status: 'planned',
      purchasedDate: null,
      targetDate: null,
      budgetCents: null,
      savedCents: null,
    })
  })

  it('stores an empty or missing description as null', () => {
    expect(InvestmentValues.from({ ...validInput, description: '   ' }).description).toBeNull()
    expect(InvestmentValues.from({ title: 'x', estimatedCostCents: 0, priority: 'low' }).description).toBeNull()
  })

  it('keeps the target date, budget and savings', () => {
    const values = InvestmentValues.from({ ...validInput, targetDate: '2027-03-01', budgetCents: 5, savedCents: 0 })
    expect([values.targetDate, values.budgetCents, values.savedCents]).toEqual(['2027-03-01', 5, 0])
    expect(InvestmentValues.from({ ...validInput, targetDate: ' ' }).targetDate).toBeNull()
  })

  it('needs the purchase date exactly when purchased', () => {
    const purchased = InvestmentValues.from({ ...validInput, status: 'purchased', purchasedDate: '2026-11-18' })
    expect([purchased.status, purchased.purchasedDate]).toEqual(['purchased', '2026-11-18'])
    const planned = InvestmentValues.from({ ...validInput, status: 'planned', purchasedDate: '2026-11-18' })
    expect(planned.purchasedDate).toBeNull()
  })

  it.each<[string, Partial<InvestmentInput>, string]>([
    ['empty title', { title: '   ' }, 'An investment needs a title.'],
    ['negative cost', { estimatedCostCents: -1 }, 'The estimated cost must be a non-negative amount.'],
    ['fractional cost', { estimatedCostCents: 1.5 }, 'The estimated cost must be a non-negative amount.'],
    ['unknown priority', { priority: 'urgent' as InvestmentInput['priority'] }, 'Unknown priority "urgent".'],
    ['unknown status', { status: 'sold' as InvestmentInput['status'] }, 'Unknown status.'],
    ['negative budget', { budgetCents: -1 }, 'The budget must be a non-negative amount.'],
    ['fractional savings', { savedCents: 0.5 }, 'The amount saved must be a non-negative amount.'],
    ['invalid target date', { targetDate: '2026-02-30' }, 'The target date is not a valid date.'],
    ['purchase without date', { status: 'purchased' }, 'Enter the date it was purchased.'],
    [
      'invalid purchase date',
      { status: 'purchased', purchasedDate: '1.1.2026' },
      'The purchase date is not a valid date.',
    ],
  ])('rejects %s', (_, change, message) => {
    expect(() => InvestmentValues.from({ ...validInput, ...change })).toThrow(message)
  })
})

describe('investmentInputOf', () => {
  it('returns the editable fields of an investment', () => {
    expect(investmentInputOf(investment({ budgetCents: 7 }))).toEqual({
      title: 'Roof',
      description: null,
      estimatedCostCents: 100_000,
      priority: 'medium',
      status: 'planned',
      purchasedDate: null,
      targetDate: null,
      budgetCents: 7,
      savedCents: null,
    })
  })
})

describe('InvestmentOrder.from', () => {
  it('keeps a copy of the ids in order', () => {
    const ids = [3, 1, 2]
    const order = InvestmentOrder.from(ids)
    ids.push(4)
    expect(order.ids).toEqual([3, 1, 2])
  })

  it.each([[[1, 1]], [[0]], [[1.5]]])('rejects %j', (ids) => {
    expect(() => InvestmentOrder.from(ids)).toThrow('Invalid order of the investments.')
  })
})

describe('movedOrder', () => {
  it('moves an id to a new position, clamped to the list', () => {
    expect(movedOrder([1, 2, 3], 3, 0)).toEqual([3, 1, 2])
    expect(movedOrder([1, 2, 3], 1, 1)).toEqual([2, 1, 3])
    expect(movedOrder([1, 2, 3], 1, 9)).toEqual([2, 3, 1])
    expect(movedOrder([1, 2, 3], 2, -1)).toEqual([2, 1, 3])
  })

  it('returns the list unchanged for an unknown id', () => {
    expect(movedOrder([1, 2], 5, 0)).toEqual([1, 2])
  })
})

describe('plannedInvestments / purchasedInvestments', () => {
  const list = [
    investment({ id: 1, sortOrder: 2 }),
    investment({ id: 2, sortOrder: 1 }),
    investment({ id: 3, sortOrder: 1 }),
    investment({ id: 4, status: 'purchased', purchasedDate: '2026-01-01' }),
    investment({ id: 5, status: 'purchased', purchasedDate: '2026-05-01' }),
    investment({ id: 6, status: 'purchased', purchasedDate: '2026-05-01' }),
    investment({ id: 7, status: 'purchased', purchasedDate: null }),
  ]

  it('sorts planned ones by position, then id', () => {
    expect(plannedInvestments(list).map(({ id }) => id)).toEqual([2, 3, 1])
  })

  it('sorts purchased ones by newest purchase, then newest id', () => {
    expect(purchasedInvestments(list).map(({ id }) => id)).toEqual([6, 5, 4, 7])
  })
})

describe('savingsProgress', () => {
  it('is null when nothing is being saved', () => {
    expect(savingsProgress(investment(), '2026-11-18')).toBeNull()
  })

  it('measures against the budget, else the estimated cost', () => {
    expect(savingsProgress(investment({ savedCents: 25_000 }), '2026-11-18')).toEqual({
      savedCents: 25_000,
      goalCents: 100_000,
      share: 0.25,
      remainingCents: 75_000,
      monthlyCents: null,
    })
    const withBudget = savingsProgress(investment({ savedCents: 25_000, budgetCents: 50_000 }), '2026-11-18')
    expect(withBudget?.share).toBe(0.5)
  })

  it('caps the share at 1 and the remainder at 0', () => {
    const done = savingsProgress(investment({ savedCents: 200_000, targetDate: '2027-01-01' }), '2026-11-18')
    expect([done?.share, done?.remainingCents, done?.monthlyCents]).toEqual([1, 0, 0])
    expect(savingsProgress(investment({ savedCents: 0, estimatedCostCents: 0 }), '2026-11-18')?.share).toBe(1)
  })

  it('spreads the remainder over the months until the target date', () => {
    const progress = savingsProgress(investment({ savedCents: 40_000, targetDate: '2027-05-18' }), '2026-11-18')
    expect(progress?.monthlyCents).toBe(10_000)
    const late = savingsProgress(investment({ savedCents: 40_000, targetDate: '2026-01-01' }), '2026-11-18')
    expect(late?.monthlyCents).toBe(60_000)
  })
})

describe('isOverBudget', () => {
  it('compares the estimate with the budget', () => {
    expect(isOverBudget({ budgetCents: null, estimatedCostCents: 5 })).toBe(false)
    expect(isOverBudget({ budgetCents: 5, estimatedCostCents: 5 })).toBe(false)
    expect(isOverBudget({ budgetCents: 4, estimatedCostCents: 5 })).toBe(true)
  })
})

describe('labels', () => {
  it('names priorities and statuses', () => {
    expect(priorityLabel('high')).toBe('High')
    expect(statusLabel('purchased')).toBe('Purchased')
  })
})
