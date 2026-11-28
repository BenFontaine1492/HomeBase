import { execute, select, type SqlValue } from '@/infrastructure/database'
import { insertedId, rethrowConstraintError } from './repository-errors'
import type { Cost, CostValues, PaymentMethod } from '@/types/cost'
import type { CostDetailsValues } from '@/types/cost-details'

interface CostRow {
  id: number
  paid_date: string
  amount_cents: number
  category: string | null
  description: string | null
  payee: string | null
  payment_method: PaymentMethod | null
  notes: string | null
  household_object_id: number | null
  maintenance_record_id: number | null
  investment_id: number | null
  recurring_cost_id: number | null
  object_id: number | null
  created_at: string
  updated_at: string
}

function mapRow(row: CostRow): Cost {
  return {
    id: row.id,
    paidDate: row.paid_date,
    amountCents: row.amount_cents,
    category: row.category,
    description: row.description,
    payee: row.payee,
    paymentMethod: row.payment_method,
    notes: row.notes,
    householdObjectId: row.household_object_id,
    maintenanceRecordId: row.maintenance_record_id,
    investmentId: row.investment_id,
    recurringCostId: row.recurring_cost_id,
    objectId: row.object_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** The columns the cost form writes, in the order of `toParams` ($1 … $9). */
export const COST_COLUMNS = `paid_date, amount_cents, category, description, payee, payment_method, notes,
                             household_object_id, investment_id`

/** Column values in the order of `COST_COLUMNS`. */
export function toParams(values: CostValues): SqlValue[] {
  return [
    values.paidDate,
    values.amountCents,
    values.category,
    values.description,
    values.payee,
    values.paymentMethod,
    values.notes,
    values.householdObjectId,
    values.investmentId,
  ]
}

/** All costs, newest first. `object_id` is the direct link or the object of the maintenance record. */
export async function findAll(): Promise<Cost[]> {
  const rows = await select<CostRow>(
    `SELECT c.id, c.paid_date, c.amount_cents, c.category, c.description, c.payee, c.payment_method, c.notes,
            c.household_object_id, c.maintenance_record_id,
            c.investment_id, c.recurring_cost_id,
            coalesce(c.household_object_id, r.household_object_id) AS object_id,
            c.created_at, c.updated_at
       FROM costs c
       LEFT JOIN maintenance_records r ON r.id = c.maintenance_record_id
      ORDER BY c.paid_date DESC, c.id DESC`,
  )
  return rows.map(mapRow)
}

/** Inserts a cost and returns its id. A missing object or investment throws `MissingReferenceError`. */
export async function insert(values: CostValues): Promise<number> {
  const result = await execute(
    `INSERT INTO costs (${COST_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    toParams(values),
  ).catch(rethrowConstraintError)
  return insertedId(result, 'cost')
}

/**
 * Updates the fields of the cost form. Its maintenance record and rule stay.
 * false = no such cost; a missing reference throws `MissingReferenceError`.
 */
export async function update(id: number, values: CostValues): Promise<boolean> {
  const result = await execute(
    `UPDATE costs
        SET paid_date = $1,
            amount_cents = $2,
            category = $3,
            description = $4,
            payee = $5,
            payment_method = $6,
            notes = $7,
            household_object_id = $8,
            investment_id = $9,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $10`,
    [...toParams(values), id],
  ).catch(rethrowConstraintError)
  return result.rowsAffected > 0
}

/**
 * Updates the fields of a maintenance record's cost that the Finances page edits (the
 * record owns its date, amount and payee). false = no such cost.
 */
export async function updateDetails(id: number, values: CostDetailsValues): Promise<boolean> {
  const result = await execute(
    `UPDATE costs
        SET category = $1,
            description = $2,
            payment_method = $3,
            notes = $4,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $5`,
    [values.category, values.description, values.paymentMethod, values.notes, id],
  )
  return result.rowsAffected > 0
}

/** Deletes a cost; its receipts go with it (ON DELETE CASCADE). false = no such cost. */
export async function remove(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM costs WHERE id = $1', [id])
  return result.rowsAffected > 0
}
