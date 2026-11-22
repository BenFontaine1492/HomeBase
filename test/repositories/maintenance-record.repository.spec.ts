import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn(), transaction: vi.fn() }))

import { execute, select, transaction } from '@/infrastructure/database'
import * as repository from '@/repositories/maintenance-record.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import { MaintenanceRecordValues } from '@/types/maintenance-record'

const values = MaintenanceRecordValues.from({
  taskId: 2,
  date: '2025-10-01',
  costCents: 250_00,
  provider: 'Heating Co',
  notes: null,
})
const withoutCost = MaintenanceRecordValues.from({ taskId: 2, date: '2025-10-01', costCents: null })
const params = [2, '2025-10-01', 'Heating Co', null]

/** The statements of the last transaction. */
function statements() {
  return vi.mocked(transaction).mock.calls.at(-1)?.[0] ?? []
}

describe('findAll', () => {
  it('maps rows to records, with the cost from the costs table', async () => {
    vi.mocked(select).mockResolvedValue([
      {
        id: 1,
        household_object_id: 7,
        task_id: null,
        date: '2025-10-01',
        cost_cents: null,
        provider: null,
        notes: 'n',
        created_at: 'c',
        updated_at: 'u',
      },
    ])
    await expect(repository.findAll()).resolves.toEqual([
      {
        id: 1,
        objectId: 7,
        taskId: null,
        date: '2025-10-01',
        costCents: null,
        provider: null,
        notes: 'n',
        createdAt: 'c',
        updatedAt: 'u',
      },
    ])
    expect(vi.mocked(select).mock.calls[0]?.[0]).toContain('LEFT JOIN costs')
  })
})

describe('insert', () => {
  it('inserts a record of the object and its cost in one transaction', async () => {
    vi.mocked(transaction).mockResolvedValue([{ rowsAffected: 1, lastInsertId: 5 }, { rowsAffected: 1 }])
    await expect(repository.insert(7, values)).resolves.toBe(5)
    const [record, cost] = statements()
    expect(record?.params).toEqual([...params, 7])
    expect(cost?.sql).toContain('last_insert_rowid()')
    expect(cost?.params).toEqual(['2025-10-01', 250_00, 'Heating Co'])
  })

  it('writes no cost row without a cost', async () => {
    vi.mocked(transaction).mockResolvedValue([{ rowsAffected: 1, lastInsertId: 5 }])
    await repository.insert(7, withoutCost)
    expect(statements()).toHaveLength(1)
  })

  it('reports a missing object or task as MissingReferenceError', async () => {
    vi.mocked(transaction).mockRejectedValue(new Error('FOREIGN KEY constraint failed'))
    await expect(repository.insert(7, values)).rejects.toBeInstanceOf(MissingReferenceError)
    await expect(repository.update(5, values)).rejects.toBeInstanceOf(MissingReferenceError)
  })
})

describe('update / remove', () => {
  it('updates a record and upserts its cost, keeping the tax fields', async () => {
    vi.mocked(transaction).mockResolvedValue([{ rowsAffected: 1 }, { rowsAffected: 1 }])
    await expect(repository.update(5, values)).resolves.toBe(true)
    const [record, cost] = statements()
    expect(record?.params).toEqual([...params, 5])
    expect(cost?.sql).toContain('ON CONFLICT (maintenance_record_id) DO UPDATE')
    expect(cost?.sql).not.toContain('tax_category_id')
    expect(cost?.params).toEqual(['2025-10-01', 250_00, 'Heating Co', 5])
  })

  it('deletes the cost when it is removed, and reports a missing record', async () => {
    vi.mocked(transaction).mockResolvedValue([{ rowsAffected: 0 }, { rowsAffected: 0 }])
    await expect(repository.update(5, withoutCost)).resolves.toBe(false)
    expect(statements()[1]).toEqual({ sql: 'DELETE FROM costs WHERE maintenance_record_id = $1', params: [5] })
  })

  it('deletes a record and reports whether it existed', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.remove(5)).resolves.toBe(true)
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(repository.remove(5)).resolves.toBe(false)
  })
})
