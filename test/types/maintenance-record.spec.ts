import { describe, expect, it } from 'vitest'
import { MaintenanceRecordValues, type MaintenanceRecordInput } from '@/types/maintenance-record'

const input: MaintenanceRecordInput = {
  taskId: 3,
  date: ' 2025-10-01 ',
  costCents: 250_00,
  provider: ' Heating Co ',
  notes: ' ',
}

describe('MaintenanceRecordValues.from', () => {
  it('can only be created through from() (checked by the type check)', () => {
    const plain = { ...MaintenanceRecordValues.from(input) }
    // @ts-expect-error a plain copy is not a MaintenanceRecordValues
    const copy: MaintenanceRecordValues = plain
    expect(copy).not.toBeInstanceOf(MaintenanceRecordValues)
  })

  it('trims the input and turns empty text into null', () => {
    expect({ ...MaintenanceRecordValues.from(input) }).toEqual({
      taskId: 3,
      date: '2025-10-01',
      costCents: 250_00,
      provider: 'Heating Co',
      notes: null,
    })
    expect({ ...MaintenanceRecordValues.from({ taskId: null, date: '2025-10-01' }) }).toEqual({
      taskId: null,
      date: '2025-10-01',
      costCents: null,
      provider: null,
      notes: null,
    })
  })

  it.each([
    [{ taskId: 1.5 }, 'Invalid task.'],
    [{ date: '' }, 'Enter the date the maintenance was done.'],
    [{ date: '2025-02-30' }, 'Enter the date the maintenance was done.'],
    [{ costCents: -1 }, 'The cost must be a non-negative amount.'],
    [{ costCents: 0.5 }, 'The cost must be a non-negative amount.'],
  ])('rejects %j', (change, message) => {
    expect(() => MaintenanceRecordValues.from({ ...input, ...change })).toThrow(message)
  })
})
