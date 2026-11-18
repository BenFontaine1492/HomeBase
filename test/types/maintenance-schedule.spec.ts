import { describe, expect, it } from 'vitest'
import type { MaintenanceRecord } from '@/types/maintenance-record'
import {
  addInterval,
  compareByUrgency,
  dueSoonWindowDays,
  effectiveLastDone,
  scheduleOf,
  summarise,
  summaryLabel,
  type MaintenanceSchedule,
  type MaintenanceStatus,
} from '@/types/maintenance-schedule'
import type { MaintenanceTask } from '@/types/maintenance-task'

function task(change: Partial<MaintenanceTask> = {}): MaintenanceTask {
  return {
    id: 1,
    objectId: 7,
    name: 'Service',
    intervalValue: 1,
    intervalUnit: 'year',
    lastDoneDate: null,
    notes: null,
    active: true,
    createdAt: '',
    updatedAt: '',
    ...change,
  }
}

function record(id: number, taskId: number | null, date: string): MaintenanceRecord {
  return { id, objectId: 7, taskId, date, costCents: null, provider: null, notes: null, createdAt: '', updatedAt: '' }
}

const noDates = { installationDate: null, purchaseDate: null }
const options = { today: '2026-11-18', dueSoonDays: null }

describe('dueSoonWindowDays', () => {
  it.each([
    [1, 'year', 30],
    [2, 'year', 30],
    [1, 'month', 3],
    [1, 'week', 1],
    [3, 'day', 1],
    [100, 'day', 10],
  ] as const)('default rule: %i %s → %i days', (intervalValue, intervalUnit, days) => {
    expect(dueSoonWindowDays({ intervalValue, intervalUnit }, null)).toBe(days)
  })

  it('uses the custom setting instead', () => {
    expect(dueSoonWindowDays({ intervalValue: 1, intervalUnit: 'week' }, 60)).toBe(60)
  })
})

describe('addInterval', () => {
  it.each([
    [1, 'day', '2026-01-31'],
    [2, 'week', '2026-02-13'],
    [1, 'month', '2026-02-28'],
    [1, 'year', '2027-01-30'],
  ] as const)('2026-01-30 + %i %s = %s', (intervalValue, intervalUnit, expected) => {
    expect(addInterval('2026-01-30', { intervalValue, intervalUnit })).toBe(expected)
  })
})

describe('effectiveLastDone', () => {
  it('takes the later of the task date and its newest record', () => {
    const records = [record(1, 1, '2025-03-01'), record(2, 1, '2025-09-01'), record(3, 2, '2026-01-01')]
    expect(effectiveLastDone(task(), records)).toBe('2025-09-01')
    expect(effectiveLastDone(task({ lastDoneDate: '2025-12-24' }), records)).toBe('2025-12-24')
    expect(effectiveLastDone(task(), [record(3, null, '2026-01-01')])).toBeNull()
  })
})

describe('scheduleOf', () => {
  it('counts from the last maintenance', () => {
    expect(scheduleOf(task(), [record(1, 1, '2026-01-10')], noDates, options)).toEqual({
      status: 'ok',
      lastDone: '2026-01-10',
      dueDate: '2027-01-10',
      daysUntilDue: 53,
    })
  })

  it('falls back to the installation date, then the purchase date', () => {
    const installed = { installationDate: '2025-12-01', purchaseDate: '2025-01-01' }
    expect(scheduleOf(task(), [], installed, options)).toMatchObject({ status: 'due-soon', dueDate: '2026-12-01' })
    const bought = { installationDate: null, purchaseDate: '2025-01-01' }
    expect(scheduleOf(task(), [], bought, options)).toMatchObject({ status: 'overdue', daysUntilDue: -321 })
  })

  it('is unknown without any date and paused when switched off', () => {
    expect(scheduleOf(task(), [], noDates, options)).toEqual({
      status: 'unknown',
      lastDone: null,
      dueDate: null,
      daysUntilDue: null,
    })
    const paused = scheduleOf(task({ active: false, lastDoneDate: '2020-01-01' }), [], noDates, options)
    expect(paused).toEqual({ status: 'paused', lastDone: '2020-01-01', dueDate: null, daysUntilDue: null })
  })

  it('is due soon within the window, including the due date itself', () => {
    const lastDone = (date: string) => task({ lastDoneDate: date })
    expect(scheduleOf(lastDone('2025-11-18'), [], noDates, options).status).toBe('due-soon')
    expect(scheduleOf(lastDone('2025-12-18'), [], noDates, options).status).toBe('due-soon')
    expect(scheduleOf(lastDone('2025-12-19'), [], noDates, options).status).toBe('ok')
    expect(scheduleOf(lastDone('2025-11-17'), [], noDates, options).status).toBe('overdue')
    expect(scheduleOf(lastDone('2026-01-01'), [], noDates, { ...options, dueSoonDays: 60 }).status).toBe('due-soon')
  })
})

function schedule(status: MaintenanceStatus, daysUntilDue: number | null = null): MaintenanceSchedule {
  return { status, lastDone: null, dueDate: null, daysUntilDue }
}

describe('compareByUrgency', () => {
  it('sorts by status, then by days until due', () => {
    const schedules = [
      schedule('ok', 100),
      schedule('paused'),
      schedule('unknown'),
      schedule('overdue', -2),
      schedule('due-soon', 5),
      schedule('overdue', -30),
      schedule('unknown'),
    ]
    // Sorts a fresh array; toSorted() needs lib ES2023 (tsconfig has ES2022).
    // oxlint-disable-next-line unicorn/no-array-sort
    const sorted = schedules.sort(compareByUrgency)
    expect(sorted.map((s) => [s.status, s.daysUntilDue])).toEqual([
      ['overdue', -30],
      ['overdue', -2],
      ['due-soon', 5],
      ['unknown', null],
      ['unknown', null],
      ['ok', 100],
      ['paused', null],
    ])
  })
})

describe('summarise / summaryLabel', () => {
  it('reports the most urgent status and counts', () => {
    const summary = summarise([schedule('ok'), schedule('overdue'), schedule('due-soon'), schedule('overdue')])
    expect(summary).toEqual({ status: 'overdue', overdue: 2, dueSoon: 1 })
    expect(summaryLabel(summary)).toBe('2 overdue')
  })

  it.each([
    [[], null, null],
    [[schedule('paused')], 'paused', null],
    [[schedule('ok'), schedule('due-soon')], 'due-soon', '1 due soon'],
    [[schedule('ok'), schedule('unknown')], 'unknown', 'Date unknown'],
    [[schedule('paused'), schedule('ok')], 'ok', 'OK'],
  ] as const)('%j → %s, %s', (schedules, status, label) => {
    const summary = summarise(schedules)
    expect(summary.status).toBe(status)
    expect(summaryLabel(summary)).toBe(label)
  })
})
