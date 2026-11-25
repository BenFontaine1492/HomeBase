import { execute, select, type SqlValue } from '@/infrastructure/database'
import { insertedId, rethrowConstraintError } from './repository-errors'
import type { PaymentMethod } from '@/types/cost'
import type { Income, IncomeValues } from '@/types/income'

interface IncomeRow {
  id: number
  received_date: string
  amount_cents: number
  description: string
  payer: string | null
  payment_method: PaymentMethod | null
  category: string | null
  notes: string | null
  household_object_id: number | null
  recurring_income_id: number | null
  created_at: string
  updated_at: string
}

function mapRow(row: IncomeRow): Income {
  return {
    id: row.id,
    receivedDate: row.received_date,
    amountCents: row.amount_cents,
    description: row.description,
    payer: row.payer,
    paymentMethod: row.payment_method,
    category: row.category,
    notes: row.notes,
    householdObjectId: row.household_object_id,
    recurringIncomeId: row.recurring_income_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** The columns the income form writes, in the order of `toParams` ($1 … $8). */
export const INCOME_COLUMNS = `received_date, amount_cents, description, payer, payment_method, category, notes,
                               household_object_id`

/** Column values in the order of `INCOME_COLUMNS`. */
export function toParams(values: IncomeValues): SqlValue[] {
  return [
    values.receivedDate,
    values.amountCents,
    values.description,
    values.payer,
    values.paymentMethod,
    values.category,
    values.notes,
    values.householdObjectId,
  ]
}

/** All income, newest first. */
export async function findAll(): Promise<Income[]> {
  const rows = await select<IncomeRow>(
    `SELECT id, received_date, amount_cents, description, payer, payment_method, category, notes,
            household_object_id, recurring_income_id, created_at, updated_at
       FROM income
      ORDER BY received_date DESC, id DESC`,
  )
  return rows.map(mapRow)
}

/** Inserts an income entry and returns its id. A missing object throws `MissingReferenceError`. */
export async function insert(values: IncomeValues): Promise<number> {
  const result = await execute(
    `INSERT INTO income (${INCOME_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    toParams(values),
  ).catch(rethrowConstraintError)
  return insertedId(result, 'income')
}

/** Updates the fields of the income form; its rule stays. false = no such entry. */
export async function update(id: number, values: IncomeValues): Promise<boolean> {
  const result = await execute(
    `UPDATE income
        SET received_date = $1,
            amount_cents = $2,
            description = $3,
            payer = $4,
            payment_method = $5,
            category = $6,
            notes = $7,
            household_object_id = $8,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $9`,
    [...toParams(values), id],
  ).catch(rethrowConstraintError)
  return result.rowsAffected > 0
}

/** Deletes an income entry; its documents go with it (ON DELETE CASCADE). false = no such entry. */
export async function remove(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM income WHERE id = $1', [id])
  return result.rowsAffected > 0
}
