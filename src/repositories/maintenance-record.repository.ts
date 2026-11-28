import { execute, select, transaction, type SqlStatement, type SqlValue } from '@/infrastructure/database'
import { insertedId, rethrowConstraintError } from './repository-errors'
import type { MaintenanceRecord, MaintenanceRecordValues } from '@/types/maintenance-record'

/*
 * The cost of a record is a row in `costs` (linked by maintenance_record_id,
 * migration 0010), written in the same transaction as the record. Its paid date
 * and payee follow the record; a new cost gets `costCategory` (the service passes
 * "Maintenance" in the UI language), and what the Finances page sets is kept when
 * the record changes.
 */

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

/** Column values of the record in the order used by INSERT and UPDATE ($1 … $4). */
function toParams(values: MaintenanceRecordValues): SqlValue[] {
  return [values.taskId, values.date, values.provider, values.notes]
}

/** All records of all objects, newest first, each with its cost. */
export async function findAll(): Promise<MaintenanceRecord[]> {
  const rows = await select<MaintenanceRecordRow>(
    `SELECT r.id, r.household_object_id, r.task_id, r.date, c.amount_cents AS cost_cents, r.provider, r.notes,
            r.created_at, r.updated_at
       FROM maintenance_records r
       LEFT JOIN costs c ON c.maintenance_record_id = r.id
      ORDER BY r.date DESC, r.id DESC`,
  )
  return rows.map(mapRow)
}

/**
 * Inserts a record of object `objectId` (and its cost) and returns its id. A
 * missing object or task throws `MissingReferenceError`. (A task of another
 * object is rejected by a trigger, see migration 0004.)
 */
export async function insert(objectId: number, values: MaintenanceRecordValues, costCategory: string): Promise<number> {
  const statements: SqlStatement[] = [
    {
      sql: `INSERT INTO maintenance_records (task_id, date, provider, notes, household_object_id)
            VALUES ($1, $2, $3, $4, $5)`,
      params: [...toParams(values), objectId],
    },
  ]
  if (values.costCents !== null) {
    statements.push({
      sql: `INSERT INTO costs (paid_date, amount_cents, category, payee, maintenance_record_id)
            VALUES ($1, $2, $3, $4, last_insert_rowid())`,
      params: [values.date, values.costCents, costCategory, values.provider],
    })
  }
  const [result] = await transaction(statements).catch(rethrowConstraintError)
  return insertedId(result, 'maintenance record')
}

/**
 * The cost of record `id` after an update: inserted (with `costCategory`) or updated
 * (keeping what the Finances page set), or deleted when it is empty. Does nothing if
 * the record doesn't exist.
 */
function costStatement(id: number, values: MaintenanceRecordValues, costCategory: string): SqlStatement {
  if (values.costCents === null) {
    return { sql: 'DELETE FROM costs WHERE maintenance_record_id = $1', params: [id] }
  }
  return {
    // The WHERE clause also resolves SQLite's parsing ambiguity of INSERT … SELECT … ON CONFLICT.
    sql: `INSERT INTO costs (paid_date, amount_cents, category, payee, maintenance_record_id)
          SELECT $1, $2, $3, $4, id FROM maintenance_records WHERE id = $5
          ON CONFLICT (maintenance_record_id) DO UPDATE
             SET paid_date = excluded.paid_date,
                 amount_cents = excluded.amount_cents,
                 payee = excluded.payee,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
    params: [values.date, values.costCents, costCategory, values.provider, id],
  }
}

/** Updates a record (never its object) and its cost. false = no such record; a missing task throws `MissingReferenceError`. */
export async function update(id: number, values: MaintenanceRecordValues, costCategory: string): Promise<boolean> {
  const [result] = await transaction([
    {
      sql: `UPDATE maintenance_records
               SET task_id = $1,
                   date = $2,
                   provider = $3,
                   notes = $4,
                   updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
             WHERE id = $5`,
      params: [...toParams(values), id],
    },
    costStatement(id, values, costCategory),
  ]).catch(rethrowConstraintError)
  // One result per statement, so the UPDATE's result is always there.
  return result!.rowsAffected > 0
}

/** Deletes a record; its receipts and its cost go with it (ON DELETE CASCADE). false = no such record. */
export async function remove(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM maintenance_records WHERE id = $1', [id])
  return result.rowsAffected > 0
}
