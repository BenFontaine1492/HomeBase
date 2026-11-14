import { execute, select } from './database/database.service'
import type { Investment, InvestmentInput, InvestmentPriority } from '@/types/investment'
import { INVESTMENT_PRIORITIES } from '@/types/investment'

/** Row shape as stored in SQLite (snake_case columns). */
interface InvestmentRow {
  id: number
  title: string
  description: string | null
  estimated_cost_cents: number
  priority: InvestmentPriority
  sort_order: number
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function validate(input: InvestmentInput): void {
  if (input.title.trim().length === 0) {
    throw new Error('An investment needs a title.')
  }
  if (!Number.isSafeInteger(input.estimatedCostCents) || input.estimatedCostCents < 0) {
    throw new Error('The estimated cost must be a non-negative amount.')
  }
  if (!INVESTMENT_PRIORITIES.includes(input.priority)) {
    throw new Error(`Unknown priority "${input.priority}".`)
  }
}

export async function listInvestments(): Promise<Investment[]> {
  const rows = await select<InvestmentRow>(
    `SELECT id, title, description, estimated_cost_cents, priority, sort_order, created_at, updated_at
       FROM investments
      ORDER BY sort_order ASC, id ASC`,
  )
  return rows.map(mapRow)
}

/** Inserts a new investment at the end of the priority list and returns its id. */
function normaliseDescription(description: string | null | undefined): string | null {
  return description?.trim() || null
}

export async function createInvestment(input: InvestmentInput): Promise<number> {
  validate(input)
  const result = await execute(
    `INSERT INTO investments (title, description, estimated_cost_cents, priority, sort_order)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM investments))`,
    [input.title.trim(), normaliseDescription(input.description), input.estimatedCostCents, input.priority],
  )
  if (result.lastInsertId === undefined) {
    throw new Error('The database did not return an id for the new investment.')
  }
  return result.lastInsertId
}

/** Updates the editable fields of an investment. Its position in the list is kept. */
export async function updateInvestment(id: number, input: InvestmentInput): Promise<void> {
  validate(input)
  const result = await execute(
    `UPDATE investments
        SET title = $1,
            description = $2,
            estimated_cost_cents = $3,
            priority = $4,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $5`,
    [input.title.trim(), normaliseDescription(input.description), input.estimatedCostCents, input.priority, id],
  )
  if (result.rowsAffected === 0) {
    throw new Error('This investment no longer exists.')
  }
}

/** Permanently deletes an investment. Remaining items keep their relative order. */
export async function deleteInvestment(id: number): Promise<void> {
  const result = await execute('DELETE FROM investments WHERE id = $1', [id])
  if (result.rowsAffected === 0) {
    throw new Error('This investment no longer exists.')
  }
}
