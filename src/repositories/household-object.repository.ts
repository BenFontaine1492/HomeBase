import { execute, select, transaction, type SqlValue } from '@/infrastructure/database'
import { replaceStatements } from './household-object-attribute.repository'
import { insertedId, rethrowConstraintError } from './repository-errors'
import type { HouseholdObject, HouseholdObjectValues } from '@/types/household-object'

/** Row shape as stored in SQLite (snake_case columns). */
interface HouseholdObjectRow {
  id: number
  name: string
  category_id: number | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  purchase_date: string | null
  purchase_price_cents: number | null
  installation_date: string | null
  location: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const COLUMNS = `id, name, category_id, manufacturer, model, serial_number, purchase_date,
  purchase_price_cents, installation_date, location, notes, created_at, updated_at`

function mapRow(row: HouseholdObjectRow): HouseholdObject {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number,
    purchaseDate: row.purchase_date,
    purchasePriceCents: row.purchase_price_cents,
    installationDate: row.installation_date,
    location: row.location,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Column values in the order used by INSERT and UPDATE ($1 … $10). */
function toParams(values: HouseholdObjectValues): SqlValue[] {
  return [
    values.name,
    values.categoryId,
    values.manufacturer,
    values.model,
    values.serialNumber,
    values.purchaseDate,
    values.purchasePriceCents,
    values.installationDate,
    values.location,
    values.notes,
  ]
}

export async function findAll(): Promise<HouseholdObject[]> {
  const rows = await select<HouseholdObjectRow>(
    `SELECT ${COLUMNS}
       FROM household_objects
      ORDER BY name COLLATE NOCASE ASC, id ASC`,
  )
  return rows.map(mapRow)
}

/**
 * Inserts an object with its attributes in one transaction and returns its id.
 * A missing category throws `MissingReferenceError`.
 */
export async function insert(values: HouseholdObjectValues): Promise<number> {
  const [result] = await transaction([
    {
      sql: `INSERT INTO household_objects (name, category_id, manufacturer, model, serial_number,
              purchase_date, purchase_price_cents, installation_date, location, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      params: toParams(values),
    },
    ...replaceStatements('new', values.attributes),
  ]).catch(rethrowConstraintError)
  return insertedId(result, 'object')
}

/**
 * Updates an object and replaces its attributes in one transaction.
 * false = no such object. A missing category or object throws `MissingReferenceError`
 * (the attribute inserts fail when the object is gone).
 */
export async function update(id: number, values: HouseholdObjectValues): Promise<boolean> {
  const [result] = await transaction([
    {
      sql: `UPDATE household_objects
               SET name = $1,
                   category_id = $2,
                   manufacturer = $3,
                   model = $4,
                   serial_number = $5,
                   purchase_date = $6,
                   purchase_price_cents = $7,
                   installation_date = $8,
                   location = $9,
                   notes = $10,
                   updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
             WHERE id = $11`,
      params: [...toParams(values), id],
    },
    ...replaceStatements(id, values.attributes),
  ]).catch(rethrowConstraintError)
  // One result per statement, so the UPDATE's result is always there.
  return result!.rowsAffected > 0
}

/** Deletes an object; its attributes go with it (ON DELETE CASCADE). false = no such object. */
export async function remove(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM household_objects WHERE id = $1', [id])
  return result.rowsAffected > 0
}
