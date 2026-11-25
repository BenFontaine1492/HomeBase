import { t } from '@/i18n'
import * as recordRepository from '@/repositories/maintenance-record.repository'
import * as taskRepository from '@/repositories/maintenance-task.repository'
import { costCategoryName } from '@/types/cost'
import {
  MaintenanceRecordValues,
  type MaintenanceRecord,
  type MaintenanceRecordInput,
} from '@/types/maintenance-record'
import { MaintenanceTaskValues, type MaintenanceTask, type MaintenanceTaskInput } from '@/types/maintenance-task'
import { rethrowWithMessage } from './service-errors'

/*
 * Maintenance tasks and their history (records). "Mark as done" is adding a
 * record: when a task was last done is calculated from its records (see
 * maintenance-schedule.ts), so nothing else has to be updated with it.
 */

function taskMessages(): { missingReference: string; duplicateValue: string } {
  return { missingReference: t('errors.gone.object'), duplicateValue: t('errors.task.duplicate') }
}

function recordMessages(): { missingReference: string } {
  return { missingReference: t('errors.gone.objectOrTask') }
}

export function listTasks(): Promise<MaintenanceTask[]> {
  return taskRepository.findAll()
}

export function listRecords(): Promise<MaintenanceRecord[]> {
  return recordRepository.findAll()
}

/** Adds a task to object `objectId` and returns its id. */
export async function createTask(objectId: number, input: MaintenanceTaskInput): Promise<number> {
  return taskRepository.insert(objectId, MaintenanceTaskValues.from(input)).catch(rethrowWithMessage(taskMessages()))
}

export async function updateTask(id: number, input: MaintenanceTaskInput): Promise<void> {
  const found = await taskRepository
    .update(id, MaintenanceTaskValues.from(input))
    .catch(rethrowWithMessage(taskMessages()))
  if (!found) throw new Error(t('errors.gone.task'))
}

/** Deletes a task. Its history entries stay, without a task. */
export async function deleteTask(id: number): Promise<void> {
  if (!(await taskRepository.remove(id))) throw new Error(t('errors.gone.task'))
}

/** Adds a history entry to object `objectId` (e.g. "mark as done") and returns its id. */
export async function createRecord(objectId: number, input: MaintenanceRecordInput): Promise<number> {
  return recordRepository
    .insert(objectId, MaintenanceRecordValues.from(input), costCategoryName('maintenance'))
    .catch(rethrowWithMessage(recordMessages()))
}

export async function updateRecord(id: number, input: MaintenanceRecordInput): Promise<void> {
  const found = await recordRepository
    .update(id, MaintenanceRecordValues.from(input), costCategoryName('maintenance'))
    .catch(rethrowWithMessage(recordMessages()))
  if (!found) throw new Error(t('errors.gone.record'))
}

/** Deletes a history entry and its receipts. */
export async function deleteRecord(id: number): Promise<void> {
  if (!(await recordRepository.remove(id))) throw new Error(t('errors.gone.record'))
}
