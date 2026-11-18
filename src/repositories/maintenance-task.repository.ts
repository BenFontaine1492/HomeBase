import { execute, select, type SqlValue } from '@/infrastructure/database'
import { insertedId, rethrowConstraintError } from './repository-errors'
import type { IntervalUnit, MaintenanceTask, MaintenanceTaskValues } from '@/types/maintenance-task'

interface MaintenanceTaskRow {
  id: number
  household_object_id: number
  name: string
  interval_value: number
  interval_unit: IntervalUnit
  last_done_date: string | null
  notes: string | null
  active: number
  created_at: string
  updated_at: string
}

function mapRow(row: MaintenanceTaskRow): MaintenanceTask {
  return {
    id: row.id,
    objectId: row.household_object_id,
    name: row.name,
    intervalValue: row.interval_value,
    intervalUnit: row.interval_unit,
    lastDoneDate: row.last_done_date,
    notes: row.notes,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Column values in the order used by INSERT and UPDATE ($1 … $6). */
function toParams(values: MaintenanceTaskValues): SqlValue[] {
  return [
    values.name,
    values.intervalValue,
    values.intervalUnit,
    values.lastDoneDate,
    values.notes,
    values.active ? 1 : 0,
  ]
}

/** All tasks of all objects, by name per object. */
export async function findAll(): Promise<MaintenanceTask[]> {
  const rows = await select<MaintenanceTaskRow>(
    `SELECT id, household_object_id, name, interval_value, interval_unit, last_done_date, notes, active,
            created_at, updated_at
       FROM maintenance_tasks
      ORDER BY household_object_id ASC, name COLLATE NOCASE ASC, id ASC`,
  )
  return rows.map(mapRow)
}

/**
 * Inserts a task of object `objectId` and returns its id. A missing object throws
 * `MissingReferenceError`, a name the object already uses `DuplicateValueError`.
 */
export async function insert(objectId: number, values: MaintenanceTaskValues): Promise<number> {
  const result = await execute(
    `INSERT INTO maintenance_tasks (name, interval_value, interval_unit, last_done_date, notes, active,
                                    household_object_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [...toParams(values), objectId],
  ).catch(rethrowConstraintError)
  return insertedId(result, 'task')
}

/**
 * Updates a task (never its object). false = no such task.
 * A name the object already uses throws `DuplicateValueError`.
 */
export async function update(id: number, values: MaintenanceTaskValues): Promise<boolean> {
  const result = await execute(
    `UPDATE maintenance_tasks
        SET name = $1,
            interval_value = $2,
            interval_unit = $3,
            last_done_date = $4,
            notes = $5,
            active = $6,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $7`,
    [...toParams(values), id],
  ).catch(rethrowConstraintError)
  return result.rowsAffected > 0
}

/** Deletes a task; its records stay, without a task (ON DELETE SET NULL). false = no such task. */
export async function remove(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM maintenance_tasks WHERE id = $1', [id])
  return result.rowsAffected > 0
}
