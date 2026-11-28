import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn(), transaction: vi.fn() }))

import { execute, select, transaction } from '@/infrastructure/database'
import * as repository from '@/repositories/project.repository'
import { DuplicateValueError } from '@/repositories/repository-errors'
import { ProjectOrder, ProjectValues } from '@/types/project'

const values = ProjectValues.from({ name: 'House', description: 'Renovate' })

describe('findAll', () => {
  it('maps snake_case rows in list order', async () => {
    vi.mocked(select).mockResolvedValue([
      { id: 1, name: 'House', description: null, sort_order: 2, created_at: 'c', updated_at: 'u' },
    ])
    await expect(repository.findAll()).resolves.toEqual([
      { id: 1, name: 'House', description: null, sortOrder: 2, createdAt: 'c', updatedAt: 'u' },
    ])
    expect(select).toHaveBeenCalledWith(expect.stringContaining('ORDER BY sort_order ASC, id ASC'))
  })
})

describe('insert', () => {
  it('appends the project and returns its id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 4 })
    await expect(repository.insert(values)).resolves.toBe(4)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('COALESCE(MAX(sort_order), 0) + 1 FROM projects'), [
      'House',
      'Renovate',
    ])
  })

  it('reports a taken name as a duplicate', async () => {
    vi.mocked(execute).mockRejectedValue(new Error('UNIQUE constraint failed: index idx_projects_name'))
    await expect(repository.insert(values)).rejects.toBeInstanceOf(DuplicateValueError)
    await expect(repository.update(1, values)).rejects.toBeInstanceOf(DuplicateValueError)
  })

  it('fails when the database returns no id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.insert(values)).rejects.toThrow('The database did not return an id for the new project.')
  })
})

describe('update', () => {
  it('updates name and description by id and reports whether it existed', async () => {
    vi.mocked(execute).mockResolvedValueOnce({ rowsAffected: 1 }).mockResolvedValueOnce({ rowsAffected: 0 })
    await expect(repository.update(3, values)).resolves.toBe(true)
    await expect(repository.update(3, values)).resolves.toBe(false)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE projects'), ['House', 'Renovate', 3])
  })
})

describe('reorder', () => {
  it('numbers the listed projects 1, 2, … in one transaction', async () => {
    vi.mocked(transaction).mockResolvedValue([])
    await repository.reorder(ProjectOrder.from([5, 2]))
    expect(transaction).toHaveBeenCalledWith([
      { sql: 'UPDATE projects SET sort_order = $1 WHERE id = $2', params: [1, 5] },
      { sql: 'UPDATE projects SET sort_order = $1 WHERE id = $2', params: [2, 2] },
    ])
  })
})

describe('remove', () => {
  it('deletes the project and its investments in one transaction', async () => {
    vi.mocked(transaction)
      .mockResolvedValueOnce([{ rowsAffected: 2 }, { rowsAffected: 1 }])
      .mockResolvedValueOnce([{ rowsAffected: 0 }, { rowsAffected: 0 }])
    await expect(repository.remove(2)).resolves.toBe(true)
    await expect(repository.remove(2)).resolves.toBe(false)
    expect(transaction).toHaveBeenCalledWith([
      { sql: 'DELETE FROM investments WHERE project_id = $1', params: [2] },
      { sql: 'DELETE FROM projects WHERE id = $1', params: [2] },
    ])
  })
})
