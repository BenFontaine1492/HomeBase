import { readonly, ref, type Ref } from 'vue'
import * as maintenanceService from '@/services/maintenance.service'
import type { MaintenanceRecord, MaintenanceRecordInput } from '@/types/maintenance-record'
import {
  scheduleOf as calculateSchedule,
  summarise,
  type MaintenanceSchedule,
  type MaintenanceSummary,
  type ScheduleObject,
} from '@/types/maintenance-schedule'
import type { MaintenanceTask, MaintenanceTaskInput } from '@/types/maintenance-task'
import { todayIsoDate } from '@/utils/date'
import { describeError } from '@/utils/error'
import { useAttachments } from './useAttachments'
import { useSettings } from './useSettings'

// Module-level state: shared by every component that calls useMaintenance().
// Tasks and records of all objects (few enough to keep them all loaded); the
// schedules are calculated from them, never stored.
const tasks = ref<MaintenanceTask[]>([])
/** Newest first. */
const records = ref<MaintenanceRecord[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

function tasksOf(objectId: number): MaintenanceTask[] {
  return tasks.value.filter((task) => task.objectId === objectId)
}

/** The history of one object, newest first. */
function recordsOf(objectId: number): MaintenanceRecord[] {
  return records.value.filter((record) => record.objectId === objectId)
}

function findTask(id: number | null): MaintenanceTask | undefined {
  return id === null ? undefined : tasks.value.find((task) => task.id === id)
}

/** When `task` (of `object`) is due, as of today, with the user's "due soon" setting. */
function scheduleOf(task: MaintenanceTask, object: ScheduleObject): MaintenanceSchedule {
  return calculateSchedule(task, records.value, object, {
    today: todayIsoDate(),
    dueSoonDays: useSettings().settings.value.maintenanceDueSoonDays,
  })
}

/** The most urgent status of the objects' tasks, with counts (one object or e.g. a category). */
function summaryOf(objects: readonly (ScheduleObject & { id: number })[]): MaintenanceSummary {
  return summarise(objects.flatMap((object) => tasksOf(object.id).map((task) => scheduleOf(task, object))))
}

/** Total recorded maintenance cost of an object, in cents. */
function costOf(objectId: number): number {
  return recordsOf(objectId).reduce((sum, record) => sum + (record.costCents ?? 0), 0)
}

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    const [loadedTasks, loadedRecords] = await Promise.all([
      maintenanceService.listTasks(),
      maintenanceService.listRecords(),
    ])
    tasks.value = loadedTasks
    records.value = loadedRecords
    hasLoaded = true
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  } finally {
    isLoading.value = false
  }
}

/** Loads tasks, records and the settings the schedules use, once. */
async function ensureLoaded(): Promise<void> {
  await Promise.all([!hasLoaded && !isLoading.value ? refresh() : undefined, useSettings().ensureLoaded()])
}

// Write operations reload afterwards (deleting a task changes its records, deleting
// a record removes its receipts) and rethrow errors for the dialogs.

async function addTask(objectId: number, input: MaintenanceTaskInput): Promise<void> {
  await maintenanceService.createTask(objectId, input)
  await refresh()
}

async function updateTask(id: number, input: MaintenanceTaskInput): Promise<void> {
  await maintenanceService.updateTask(id, input)
  await refresh()
}

async function deleteTask(id: number): Promise<void> {
  await maintenanceService.deleteTask(id)
  await refresh()
}

/** Adds a history entry, e.g. "mark as done". Returns its id (to attach receipts). */
async function addRecord(objectId: number, input: MaintenanceRecordInput): Promise<number> {
  const id = await maintenanceService.createRecord(objectId, input)
  await refresh()
  return id
}

async function updateRecord(id: number, input: MaintenanceRecordInput): Promise<void> {
  await maintenanceService.updateRecord(id, input)
  await refresh()
}

/** Deletes a history entry; its receipts go with it, so the documents are reloaded too. */
async function deleteRecord(id: number): Promise<void> {
  await maintenanceService.deleteRecord(id)
  await Promise.all([refresh(), useAttachments().refresh()])
}

export interface UseMaintenance {
  tasks: Readonly<Ref<readonly MaintenanceTask[]>>
  records: Readonly<Ref<readonly MaintenanceRecord[]>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  tasksOf: (objectId: number) => MaintenanceTask[]
  recordsOf: (objectId: number) => MaintenanceRecord[]
  findTask: (id: number | null) => MaintenanceTask | undefined
  scheduleOf: (task: MaintenanceTask, object: ScheduleObject) => MaintenanceSchedule
  summaryOf: (objects: readonly (ScheduleObject & { id: number })[]) => MaintenanceSummary
  costOf: (objectId: number) => number
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  addTask: (objectId: number, input: MaintenanceTaskInput) => Promise<void>
  updateTask: (id: number, input: MaintenanceTaskInput) => Promise<void>
  deleteTask: (id: number) => Promise<void>
  addRecord: (objectId: number, input: MaintenanceRecordInput) => Promise<number>
  updateRecord: (id: number, input: MaintenanceRecordInput) => Promise<void>
  deleteRecord: (id: number) => Promise<void>
}

export function useMaintenance(): UseMaintenance {
  return {
    tasks: readonly(tasks) as Readonly<Ref<readonly MaintenanceTask[]>>,
    records: readonly(records) as Readonly<Ref<readonly MaintenanceRecord[]>>,
    isLoading: readonly(isLoading),
    error: readonly(error),
    tasksOf,
    recordsOf,
    findTask,
    scheduleOf,
    summaryOf,
    costOf,
    refresh,
    ensureLoaded,
    addTask,
    updateTask,
    deleteTask,
    addRecord,
    updateRecord,
    deleteRecord,
  }
}
