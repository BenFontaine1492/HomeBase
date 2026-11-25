import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/maintenance-task.repository', () => ({
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('@/repositories/maintenance-record.repository', () => ({
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

import * as recordRepository from '@/repositories/maintenance-record.repository'
import * as taskRepository from '@/repositories/maintenance-task.repository'
import { DuplicateValueError, MissingReferenceError } from '@/repositories/repository-errors'
import * as service from '@/services/maintenance.service'
import { MaintenanceRecordValues, type MaintenanceRecordInput } from '@/types/maintenance-record'
import { MaintenanceTaskValues, type MaintenanceTaskInput } from '@/types/maintenance-task'

const task: MaintenanceTaskInput = { name: ' Service ', intervalValue: 1, intervalUnit: 'year', active: true }
const record: MaintenanceRecordInput = { taskId: 2, date: '2025-10-01', costCents: 100 }
const missing = new MissingReferenceError('FOREIGN KEY constraint failed')
const duplicate = new DuplicateValueError('UNIQUE constraint failed')

describe('lists', () => {
  it('return the repositories’ rows', async () => {
    vi.mocked(taskRepository.findAll).mockResolvedValue([])
    vi.mocked(recordRepository.findAll).mockResolvedValue([])
    await expect(service.listTasks()).resolves.toEqual([])
    await expect(service.listRecords()).resolves.toEqual([])
  })
})

describe('tasks', () => {
  it('creates a task from validated values', async () => {
    vi.mocked(taskRepository.insert).mockResolvedValue(4)
    await expect(service.createTask(7, task)).resolves.toBe(4)
    const [objectId, values] = vi.mocked(taskRepository.insert).mock.calls[0] ?? []
    expect(objectId).toBe(7)
    expect(values).toBeInstanceOf(MaintenanceTaskValues)
    expect(values).toMatchObject({ name: 'Service' })
  })

  it('rejects invalid input before writing', async () => {
    await expect(service.createTask(7, { ...task, name: '' })).rejects.toThrow('A task needs a name.')
    expect(taskRepository.insert).not.toHaveBeenCalled()
  })

  it('reports a deleted object and a name the object already uses', async () => {
    vi.mocked(taskRepository.insert).mockRejectedValue(missing)
    await expect(service.createTask(7, task)).rejects.toThrow('This object no longer exists.')
    vi.mocked(taskRepository.update).mockRejectedValue(duplicate)
    await expect(service.updateTask(4, task)).rejects.toThrow('This object already has a task with this name.')
  })

  it('updates and deletes tasks, or reports a deleted one', async () => {
    vi.mocked(taskRepository.update).mockResolvedValue(true)
    await service.updateTask(4, task)
    vi.mocked(taskRepository.update).mockResolvedValue(false)
    await expect(service.updateTask(4, task)).rejects.toThrow('This maintenance task no longer exists.')
    vi.mocked(taskRepository.remove).mockResolvedValue(true)
    await service.deleteTask(4)
    vi.mocked(taskRepository.remove).mockResolvedValue(false)
    await expect(service.deleteTask(4)).rejects.toThrow('This maintenance task no longer exists.')
  })
})

describe('records', () => {
  it('creates a record from validated values; a new cost gets the maintenance category', async () => {
    vi.mocked(recordRepository.insert).mockResolvedValue(5)
    await expect(service.createRecord(7, record)).resolves.toBe(5)
    const [objectId, values, category] = vi.mocked(recordRepository.insert).mock.calls[0] ?? []
    expect(objectId).toBe(7)
    expect(values).toBeInstanceOf(MaintenanceRecordValues)
    expect(category).toBe('Maintenance')
  })

  it('reports a deleted object or task', async () => {
    const message = 'This object or its maintenance task no longer exists.'
    vi.mocked(recordRepository.insert).mockRejectedValue(missing)
    await expect(service.createRecord(7, record)).rejects.toThrow(message)
    vi.mocked(recordRepository.update).mockRejectedValue(missing)
    await expect(service.updateRecord(5, record)).rejects.toThrow(message)
  })

  it('updates and deletes records, or reports a deleted one', async () => {
    vi.mocked(recordRepository.update).mockResolvedValue(true)
    await service.updateRecord(5, record)
    expect(vi.mocked(recordRepository.update).mock.calls[0]?.[2]).toBe('Maintenance')
    vi.mocked(recordRepository.update).mockResolvedValue(false)
    await expect(service.updateRecord(5, record)).rejects.toThrow('This maintenance entry no longer exists.')
    vi.mocked(recordRepository.remove).mockResolvedValue(true)
    await service.deleteRecord(5)
    vi.mocked(recordRepository.remove).mockResolvedValue(false)
    await expect(service.deleteRecord(5)).rejects.toThrow('This maintenance entry no longer exists.')
  })
})
