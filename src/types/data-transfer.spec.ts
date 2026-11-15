import { describe, expect, it } from 'vitest'
import { tableLabel } from './data-transfer'

describe('tableLabel', () => {
  it('returns the readable name of a known table', () => {
    expect(tableLabel('household_objects')).toBe('Inventory objects')
  })

  it('falls back to the table name', () => {
    expect(tableLabel('future_table')).toBe('future_table')
  })
})
