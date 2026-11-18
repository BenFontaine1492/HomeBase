import { describe, expect, it } from 'vitest'
import {
  INTERVAL_PRESETS,
  intervalLabel,
  intervalOf,
  intervalPresetLabel,
  MaintenanceTaskValues,
  presetOf,
  type IntervalUnit,
  type MaintenanceTaskInput,
} from '@/types/maintenance-task'

const input: MaintenanceTaskInput = {
  name: ' Service ',
  intervalValue: 1,
  intervalUnit: 'year',
  lastDoneDate: ' 2025-10-01 ',
  notes: ' ',
  active: true,
}

describe('MaintenanceTaskValues.from', () => {
  it('can only be created through from() (checked by the type check)', () => {
    const plain = { ...MaintenanceTaskValues.from(input) }
    // @ts-expect-error a plain copy is not a MaintenanceTaskValues
    const copy: MaintenanceTaskValues = plain
    expect(copy).not.toBeInstanceOf(MaintenanceTaskValues)
  })

  it('trims the input and turns empty text into null', () => {
    expect({ ...MaintenanceTaskValues.from(input) }).toEqual({
      name: 'Service',
      intervalValue: 1,
      intervalUnit: 'year',
      lastDoneDate: '2025-10-01',
      notes: null,
      active: true,
    })
    expect(MaintenanceTaskValues.from({ ...input, lastDoneDate: undefined, active: false })).toMatchObject({
      lastDoneDate: null,
      active: false,
    })
  })

  it.each([
    [{ name: ' ' }, 'A task needs a name.'],
    [{ intervalValue: 0 }, 'The interval must be a whole number from 1 to 3650.'],
    [{ intervalValue: 3651 }, 'The interval must be a whole number from 1 to 3650.'],
    [{ intervalValue: 1.5 }, 'The interval must be a whole number from 1 to 3650.'],
    [{ intervalUnit: 'decade' as IntervalUnit }, 'Unknown interval unit.'],
    [{ lastDoneDate: '2025-02-30' }, 'The date of the last maintenance is not a valid date.'],
  ])('rejects %j', (change, message) => {
    expect(() => MaintenanceTaskValues.from({ ...input, ...change })).toThrow(message)
  })
})

describe('interval presets', () => {
  it('round-trips every preset', () => {
    for (const preset of INTERVAL_PRESETS) {
      expect(presetOf(intervalOf(preset, 10))).toBe(preset)
    }
    expect(intervalOf('custom', 10)).toEqual({ intervalValue: 10, intervalUnit: 'day' })
    expect(intervalOf('yearly', 10)).toEqual({ intervalValue: 1, intervalUnit: 'year' })
  })

  it('has no preset for intervals the form cannot show', () => {
    expect(presetOf({ intervalValue: 3, intervalUnit: 'month' })).toBeNull()
  })

  it.each([
    [1, 'year', 'Yearly'],
    [1, 'month', 'Monthly'],
    [1, 'week', 'Weekly'],
    [1, 'day', 'Daily'],
    [10, 'day', 'Every 10 days'],
    [3, 'month', 'Every 3 months'],
  ] as const)('labels %i %s as %s', (intervalValue, intervalUnit, label) => {
    expect(intervalLabel({ intervalValue, intervalUnit })).toBe(label)
  })
})

describe('intervalPresetLabel', () => {
  it('names the form choices', () => {
    expect(INTERVAL_PRESETS.map(intervalPresetLabel)).toEqual([
      'Yearly',
      'Monthly',
      'Weekly',
      'Custom (number of days)',
    ])
  })
})
