import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaintenanceRecord } from '@/types/maintenance-record'
import type { MaintenanceTask } from '@/types/maintenance-task'
import { todayIsoDate } from '@/utils/date'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({
  listTasks: vi.fn(),
  listRecords: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  createRecord: vi.fn(),
  updateRecord: vi.fn(),
  deleteRecord: vi.fn(),
}))
vi.mock('@/services/maintenance.service', () => service)
const settings = vi.hoisted(() => ({ value: { maintenanceDueSoonDays: null as number | null }, ensureLoaded: vi.fn() }))
vi.mock('@/composables/useSettings', () => ({
  useSettings: () => ({ settings, ensureLoaded: settings.ensureLoaded }),
}))
const refreshAttachments = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useAttachments', () => ({ useAttachments: () => ({ refresh: refreshAttachments }) }))
const refreshCosts = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useCosts', () => ({ useCosts: () => ({ refresh: refreshCosts }) }))

function task(id: number, objectId: number, lastDoneDate: string | null = null): MaintenanceTask {
  return {
    id,
    objectId,
    name: `#${id}`,
    intervalValue: 1,
    intervalUnit: 'year',
    lastDoneDate,
    notes: null,
    active: true,
    createdAt: '',
    updatedAt: '',
  }
}

function record(id: number, objectId: number, taskId: number | null, costCents: number | null): MaintenanceRecord {
  return {
    id,
    objectId,
    taskId,
    date: todayIsoDate(),
    costCents,
    provider: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
  }
}

const noDates = { installationDate: null, purchaseDate: null }

/** Fresh module-level state for every test. */
async function load() {
  vi.resetModules()
  const { useMaintenance } = await import('@/composables/useMaintenance')
  return useMaintenance()
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  settings.value = { maintenanceDueSoonDays: null }
  vi.mocked(service.listTasks).mockResolvedValue([task(1, 7, '2000-01-01'), task(2, 7), task(3, 8)])
  vi.mocked(service.listRecords).mockResolvedValue([record(1, 7, 2, 250_00), record(2, 7, null, null)])
})

describe('useMaintenance', () => {
  it('loads tasks, records and settings once and filters them per object', async () => {
    const state = await load()

    await state.ensureLoaded()
    await state.ensureLoaded()

    expect(service.listTasks).toHaveBeenCalledTimes(1)
    expect(settings.ensureLoaded).toHaveBeenCalledTimes(2)
    expect(state.tasksOf(7).map((t) => t.id)).toEqual([1, 2])
    expect(state.recordsOf(7).map((r) => r.id)).toEqual([1, 2])
    expect(state.findTask(3)?.objectId).toBe(8)
    expect(state.findTask(null)).toBeUndefined()
    expect(state.tasks.value).toHaveLength(3)
    expect(state.records.value).toHaveLength(2)
    expect(state.costOf(7)).toBe(250_00)
    expect(state.costOf(8)).toBe(0)
  })

  it('calculates schedules from the records and the setting', async () => {
    const state = await load()
    await state.refresh()

    // Task 2 was done today (record 1), so it is due in a year (365 or 366 days).
    expect(state.scheduleOf(task(2, 7), noDates).status).toBe('ok')
    settings.value = { maintenanceDueSoonDays: 366 }
    expect(state.scheduleOf(task(2, 7), noDates).status).toBe('due-soon')

    expect(state.summaryOf([{ id: 7, ...noDates }])).toEqual({ status: 'overdue', overdue: 1, dueSoon: 1 })
    expect(state.summaryOf([{ id: 8, ...noDates }]).status).toBe('unknown')
    expect(state.summaryOf([]).status).toBeNull()
  })

  it('does not start a second load while one is running', async () => {
    const state = await load()
    const first = state.refresh()
    await state.ensureLoaded()
    await first
    expect(service.listTasks).toHaveBeenCalledTimes(1)
  })

  it('keeps the error message when loading fails', async () => {
    vi.mocked(service.listRecords).mockRejectedValue(new Error('locked'))
    const state = await load()
    await state.refresh()
    expect(state.error.value).toBe('locked')
    expect(state.isLoading.value).toBe(false)
  })

  it('reloads after every write', async () => {
    vi.mocked(service.createRecord).mockResolvedValue(9)
    const state = await load()
    const taskInput = { name: 'Service', intervalValue: 1, intervalUnit: 'year', active: true } as const
    const recordInput = { taskId: 1, date: '2026-01-01' }

    await state.addTask(7, taskInput)
    await state.updateTask(1, taskInput)
    await state.deleteTask(1)
    await expect(state.addRecord(7, recordInput)).resolves.toBe(9)
    await state.updateRecord(9, recordInput)
    await state.deleteRecord(9)

    expect(service.createTask).toHaveBeenCalledWith(7, taskInput)
    expect(service.updateTask).toHaveBeenCalledWith(1, taskInput)
    expect(service.deleteTask).toHaveBeenCalledWith(1)
    expect(service.createRecord).toHaveBeenCalledWith(7, recordInput)
    expect(service.updateRecord).toHaveBeenCalledWith(9, recordInput)
    expect(service.deleteRecord).toHaveBeenCalledWith(9)
    expect(service.listTasks).toHaveBeenCalledTimes(6)
    // Deleting a record deletes its receipts; every record write changes its cost row.
    expect(refreshAttachments).toHaveBeenCalledTimes(1)
    expect(refreshCosts).toHaveBeenCalledTimes(3)
  })
})
