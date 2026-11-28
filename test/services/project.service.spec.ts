import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/project.repository', () => ({
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  reorder: vi.fn(),
  remove: vi.fn(),
}))

import * as repository from '@/repositories/project.repository'
import { DuplicateValueError } from '@/repositories/repository-errors'
import { createProject, deleteProject, listProjects, reorderProjects, updateProject } from '@/services/project.service'
import { ProjectOrder, ProjectValues } from '@/types/project'

const input = { name: ' House ', description: ' Renovate ' }

describe('listProjects', () => {
  it('returns the projects from the repository', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([])
    await expect(listProjects()).resolves.toEqual([])
  })
})

describe('createProject', () => {
  it('stores a validated value object and returns the new id', async () => {
    vi.mocked(repository.insert).mockResolvedValue(3)
    await expect(createProject(input)).resolves.toBe(3)
    const values = vi.mocked(repository.insert).mock.calls[0]?.[0]
    expect(values).toBeInstanceOf(ProjectValues)
    expect({ ...values }).toEqual({ name: 'House', description: 'Renovate' })
  })

  it('rejects invalid input without touching the database', async () => {
    await expect(createProject({ name: ' ' })).rejects.toThrow('A project needs a name.')
    await expect(updateProject(1, { name: ' ' })).rejects.toThrow('A project needs a name.')
    expect(repository.insert).not.toHaveBeenCalled()
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('says so when the name is taken', async () => {
    vi.mocked(repository.insert).mockRejectedValue(new DuplicateValueError(new Error('UNIQUE')))
    vi.mocked(repository.update).mockRejectedValue(new DuplicateValueError(new Error('UNIQUE')))
    await expect(createProject(input)).rejects.toThrow('A project with this name already exists.')
    await expect(updateProject(1, input)).rejects.toThrow('A project with this name already exists.')
  })
})

describe('updateProject', () => {
  it('updates the project by id', async () => {
    vi.mocked(repository.update).mockResolvedValue(true)
    await updateProject(4, input)
    expect(repository.update).toHaveBeenCalledWith(4, expect.any(ProjectValues))
  })

  it('fails when the project no longer exists', async () => {
    vi.mocked(repository.update).mockResolvedValue(false)
    await expect(updateProject(4, input)).rejects.toThrow('This project no longer exists.')
  })
})

describe('reorderProjects', () => {
  it('passes the validated order to the repository', async () => {
    await reorderProjects([2, 1])
    const order = vi.mocked(repository.reorder).mock.calls[0]?.[0]
    expect(order).toBeInstanceOf(ProjectOrder)
    expect(order?.ids).toEqual([2, 1])
  })

  it('rejects an invalid order', async () => {
    await expect(reorderProjects([1, 1])).rejects.toThrow('Invalid order of the projects.')
    expect(repository.reorder).not.toHaveBeenCalled()
  })
})

describe('deleteProject', () => {
  it('deletes the project by id', async () => {
    vi.mocked(repository.remove).mockResolvedValue(true)
    await deleteProject(2)
    expect(repository.remove).toHaveBeenCalledWith(2)
  })

  it('fails when the project no longer exists', async () => {
    vi.mocked(repository.remove).mockResolvedValue(false)
    await expect(deleteProject(2)).rejects.toThrow('This project no longer exists.')
  })
})
