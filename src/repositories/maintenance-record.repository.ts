import { execute, select, type SqlValue } from '@/infrastructure/database'
import { insertedId, rethrowConstraintError } from './repository-errors'
import type { MaintenanceRecord, MaintenanceRecordValues } from '@/types/maintenance-record'

interface MaintenanceRecordRow {
  id: number
  household_object_id: number
  task_id: number | null
  date: string
  cost_cents: number | null
  provider: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

function mapRow(row: MaintenanceRecordRow): MaintenanceRecord {
  return {
    id: row.id,
    objectId: row.household_object_id,
    taskId: row.task_id,
    date: row.date,
    costCents: row.cost_cents,
    provider: row.provider,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Column values in the order used by INSERT and UPDATE ($1 … $5). */
function toParams(values: MaintenanceRecordValues): SqlValue[] {
  return [values.taskId, values.date, values.costCents, values.provider, values.notes]
}

/** All records of all objects, newest first. */
export async function findAll(): Promise<MaintenanceRecord[]> {
  const rows = await select<MaintenanceRecordRow>(
    `SELECT id, household_object_id, task_id, date, cost_cents, provider, notes, created_at, updated_at
       FROM maintenance_records
      ORDER BY date DESC, id DESC`,
  )
  return rows.map(mapRow)
}

/**
 * Inserts a record of object `objectId` and returns its id. A missing object or
 * task throws `MissingReferenceError`. (A task of another object is rejected by
 * a trigger, see migration 0004.)
 */
export async function insert(objectId: number, values: MaintenanceRecordValues): Promise<number> {
  const result = await execute(
    `INSERT INTO maintenance_records (task_id, date, cost_cents, provider, notes, household_object_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [...toParams(values), objectId],
  ).catch(rethrowConstraintError)
  return insertedId(result, 'maintenance record')
}

/** Updates a record (never its object). false = no such record; a missing task throws `MissingReferenceError`. */
export async function update(id: number, values: MaintenanceRecordValues): Promise<boolean> {
  const result = await execute(
    `UPDATE maintenance_records
        SET task_id = $1,
            date = $2,
            cost_cents = $3,
            provider = $4,
            notes = $5,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $6`,
    [...toParams(values), id],
  ).catch(rethrowConstraintError)
  return result.rowsAffected > 0
}

/** Deletes a record; its receipts go with it (ON DELETE CASCADE). false = no such record. */
export async function remove(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM maintenance_records WHERE id = $1', [id])
  return result.rowsAffected > 0
}
