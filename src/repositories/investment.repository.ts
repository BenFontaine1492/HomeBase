import { execute, select, transaction } from '@/infrastructure/database'
import { insertedId } from './repository-errors'
import type {
  Investment,
  InvestmentOrder,
  InvestmentPriority,
  InvestmentStatus,
  InvestmentValues,
} from '@/types/investment'

/** Row shape as stored in SQLite (snake_case columns). */
interface InvestmentRow {
  id: number
  title: string
  description: string | null
  estimated_cost_cents: number
  priority: InvestmentPriority
  sort_order: number
  status: InvestmentStatus
  purchased_date: string | null
  target_date: string | null
  budget_cents: number | null
  saved_cents: number | null
  created_at: string
  updated_at: string
}

function mapRow(row: InvestmentRow): Investment {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    estimatedCostCents: row.estimated_cost_cents,
    priority: row.priority,
    sortOrder: row.sort_order,
    status: row.status,
    purchasedDate: row.purchased_date,
    targetDate: row.target_date,
    budgetCents: row.budget_cents,
    savedCents: row.saved_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toParams(values: InvestmentValues) {
  return [
    values.title,
    values.description,
    values.estimatedCostCents,
    values.priority,
    values.status,
    values.purchasedDate,
    values.targetDate,
    values.budgetCents,
    values.savedCents,
  ]
}

export async function findAll(): Promise<Investment[]> {
  const rows = await select<InvestmentRow>(
    `SELECT id, title, description, estimated_cost_cents, priority, sort_order, status, purchased_date,
            target_date, budget_cents, saved_cents, created_at, updated_at
       FROM investments
      ORDER BY sort_order ASC, id ASC`,
  )
  return rows.map(mapRow)
}

/** Inserts an investment at the end of the priority list and returns its id. */
export async function insert(values: InvestmentValues): Promise<number> {
  const result = await execute(
    `INSERT INTO investments (title, description, estimated_cost_cents, priority, status, purchased_date,
                              target_date, budget_cents, saved_cents, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM investments))`,
    toParams(values),
  )
  return insertedId(result, 'investment')
}

/** Updates the editable fields; the position in the list is kept. false = no such investment. */
export async function update(id: number, values: InvestmentValues): Promise<boolean> {
  const result = await execute(
    `UPDATE investments
        SET title = $1,
            description = $2,
            estimated_cost_cents = $3,
            priority = $4,
            status = $5,
            purchased_date = $6,
            target_date = $7,
            budget_cents = $8,
            saved_cents = $9,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $10`,
    [...toParams(values), id],
  )
  return result.rowsAffected > 0
}

/** Gives the listed investments the positions 1, 2, … in one transaction. Others keep theirs. */
export async function reorder(order: InvestmentOrder): Promise<void> {
  await transaction(
    order.ids.map((id, index) => ({
      sql: 'UPDATE investments SET sort_order = $1 WHERE id = $2',
      params: [index + 1, id],
    })),
  )
}

/** Deletes an investment; the others keep their relative order. false = no such investment. */
export async function remove(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM investments WHERE id = $1', [id])
  return result.rowsAffected > 0
}
