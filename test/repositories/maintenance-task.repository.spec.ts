import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn() }))

import { execute, select } from '@/infrastructure/database'
import * as repository from '@/repositories/maintenance-task.repository'
import { DuplicateValueError, MissingReferenceError } from '@/repositories/repository-errors'
import { MaintenanceTaskValues } from '@/types/maintenance-task'

const values = MaintenanceTaskValues.from({
  name: 'Service',
  intervalValue: 1,
  intervalUnit: 'year',
  lastDoneDate: '2025-10-01',
  notes: null,
  active: false,
})
const params = ['Service', 1, 'year', '2025-10-01', null, 0]

describe('findAll', () => {
  it('maps rows to tasks', async () => {
    vi.mocked(select).mockResolvedValue([
      {
        id: 1,
        household_object_id: 7,
        name: 'Service',
        interval_value: 10,
        interval_unit: 'day',
        last_done_date: null,
        notes: 'n',
        active: 1,
        created_at: 'c',
        updated_at: 'u',
      },
    ])
    await expect(repository.findAll()).resolves.toEqual([
      {
        id: 1,
        objectId: 7,
        name: 'Service',
        intervalValue: 10,
        intervalUnit: 'day',
        lastDoneDate: null,
        notes: 'n',
        active: true,
        createdAt: 'c',
        updatedAt: 'u',
      },
    ])
  })
})

describe('insert', () => {
  it('inserts a task of the object and returns its id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 4 })
    await expect(repository.insert(7, values)).resolves.toBe(4)
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual([...params, 7])
  })

  it('reports constraint failures as typed errors', async () => {
    vi.mocked(execute).mockRejectedValue(new Error('FOREIGN KEY constraint failed'))
    await expect(repository.insert(7, values)).rejects.toBeInstanceOf(MissingReferenceError)
    vi.mocked(execute).mockRejectedValue(new Error('UNIQUE constraint failed: maintenance_tasks.name'))
    await expect(repository.update(4, values)).rejects.toBeInstanceOf(DuplicateValueError)
  })
})

describe('update / remove', () => {
  it('updates a task and reports whether it exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    const activeValues = MaintenanceTaskValues.from({ ...values, active: true })
    await expect(repository.update(4, activeValues)).resolves.toBe(true)
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual(['Service', 1, 'year', '2025-10-01', null, 1, 4])
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(repository.update(4, values)).resolves.toBe(false)
  })

  it('deletes a task and reports whether it existed', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.remove(4)).resolves.toBe(true)
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(repository.remove(4)).resolves.toBe(false)
  })
})
