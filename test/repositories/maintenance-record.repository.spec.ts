import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn() }))

import { execute, select } from '@/infrastructure/database'
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
const params = [2, '2025-10-01', 250_00, 'Heating Co', null]

describe('findAll', () => {
  it('maps rows to records', async () => {
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
  })
})

describe('insert / update / remove', () => {
  it('inserts a record of the object and returns its id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 5 })
    await expect(repository.insert(7, values)).resolves.toBe(5)
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual([...params, 7])
  })

  it('reports a missing object or task as MissingReferenceError', async () => {
    vi.mocked(execute).mockRejectedValue(new Error('FOREIGN KEY constraint failed'))
    await expect(repository.insert(7, values)).rejects.toBeInstanceOf(MissingReferenceError)
    await expect(repository.update(5, values)).rejects.toBeInstanceOf(MissingReferenceError)
  })

  it('updates a record and reports whether it exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.update(5, values)).resolves.toBe(true)
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual([...params, 5])
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(repository.update(5, values)).resolves.toBe(false)
  })

  it('deletes a record and reports whether it existed', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.remove(5)).resolves.toBe(true)
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(repository.remove(5)).resolves.toBe(false)
  })
})
