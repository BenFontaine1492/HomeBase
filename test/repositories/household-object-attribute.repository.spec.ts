import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn() }))

import { select } from '@/infrastructure/database'
import * as repository from '@/repositories/household-object-attribute.repository'
import { HouseholdObjectAttributeValues } from '@/types/household-object-attribute'

describe('findAll', () => {
  it('maps snake_case rows in display order', async () => {
    vi.mocked(select).mockResolvedValue([
      { id: 3, household_object_id: 7, name: 'Power', value_type: 'number', value: '12.5', unit: 'kW', sort_order: 0 },
    ])
    await expect(repository.findAll()).resolves.toEqual([
      { id: 3, objectId: 7, name: 'Power', valueType: 'number', value: '12.5', unit: 'kW', sortOrder: 0 },
    ])
    expect(select).toHaveBeenCalledWith(expect.stringContaining('ORDER BY household_object_id ASC, sort_order ASC'))
  })
})

describe('replaceStatements', () => {
  const attributes = HouseholdObjectAttributeValues.listFrom([
    { name: 'Power', valueType: 'number', value: '12.5', unit: 'kW' },
    { name: 'Refrigerant', valueType: 'text', value: 'R290' },
  ])

  it('deletes and re-inserts the attributes of an existing object', () => {
    const [removal, ...inserts] = repository.replaceStatements(7, attributes)
    expect(removal).toEqual({
      sql: 'DELETE FROM household_object_attributes WHERE household_object_id = $1',
      params: [7],
    })
    expect(inserts.map((statement) => statement.params)).toEqual([
      ['Power', 'number', '12.5', 'kW', 0, 7],
      ['Refrigerant', 'text', 'R290', null, 1, 7],
    ])
    expect(inserts[0]?.sql).toContain('VALUES ($6, $1, $2, $3, $4, $5)')
  })

  it('removes all attributes when the list is empty', () => {
    expect(repository.replaceStatements(7, [])).toHaveLength(1)
  })

  it('only inserts for a new object, referring to the newest object id', () => {
    const inserts = repository.replaceStatements('new', attributes)
    expect(inserts).toHaveLength(2)
    expect(inserts[1]?.sql).toContain('VALUES ((SELECT max(id) FROM household_objects), $1, $2, $3, $4, $5)')
    expect(inserts[1]?.params).toEqual(['Refrigerant', 'text', 'R290', null, 1])
  })
})
