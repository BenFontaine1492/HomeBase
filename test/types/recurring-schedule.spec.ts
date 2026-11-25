import { describe, expect, it } from 'vitest'
import {
  autopayRuns,
  dueDatesOf,
  dueOccurrences,
  isFinished,
  MAX_CATCH_UP,
  nextDueAfter,
  type RecurringRule,
} from '@/types/recurring-schedule'

function rule(id: number, fields: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id,
    intervalValue: 1,
    intervalUnit: 'month',
    startDate: '2026-01-31',
    endDate: null,
    nextDueDate: '2026-01-31',
    autopay: false,
    ...fields,
  }
}

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
    const due = dueOccurrences(rules, '2026-03-10').map(({ rule: r, dueDate, moreCount }) => [r.id, dueDate, moreCount])
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
})
