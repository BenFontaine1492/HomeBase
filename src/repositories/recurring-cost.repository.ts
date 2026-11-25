import { execute, select, transaction, type SqlStatement, type SqlValue } from '@/infrastructure/database'
import { COST_COLUMNS, toParams as costParams } from './cost.repository'
import { insertedId, rethrowConstraintError } from './repository-errors'
import type { CostType, CostValues, PaymentMethod } from '@/types/cost'
import type { IntervalUnit } from '@/types/maintenance-task'
import type { RecurringCost, RecurringCostValues } from '@/types/recurring-cost'

interface RecurringCostRow {
  id: number
  description: string
  payee: string | null
  amount_cents: number
  labour_cents: number | null
  cost_type: CostType
  tax_category_id: number | null
  payment_method: PaymentMethod | null
  household_object_id: number | null
  interval_value: number
  interval_unit: IntervalUnit
  start_date: string
  end_date: string | null
  next_due_date: string
  autopay: number
  notes: string | null
  created_at: string
  updated_at: string
}

function mapRow(row: RecurringCostRow): RecurringCost {
  return {
    id: row.id,
    description: row.description,
    payee: row.payee,
    amountCents: row.amount_cents,
    labourCents: row.labour_cents,
    costType: row.cost_type,
    taxCategoryId: row.tax_category_id,
    paymentMethod: row.payment_method,
    householdObjectId: row.household_object_id,
    intervalValue: row.interval_value,
    intervalUnit: row.interval_unit,
    startDate: row.start_date,
    endDate: row.end_date,
    nextDueDate: row.next_due_date,
    autopay: row.autopay === 1,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Column values in the order used by INSERT and UPDATE ($1 … $14). */
function toParams(values: RecurringCostValues): SqlValue[] {
  return [
    values.description,
    values.payee,
    values.amountCents,
    values.labourCents,
    values.costType,
    values.taxCategoryId,
    values.paymentMethod,
    values.householdObjectId,
    values.intervalValue,
    values.intervalUnit,
    values.startDate,
    values.endDate,
    values.autopay ? 1 : 0,
    values.notes,
  ]
}

/** All rules, by description. */
export async function findAll(): Promise<RecurringCost[]> {
  const rows = await select<RecurringCostRow>(
    `SELECT id, description, payee, amount_cents, labour_cents, cost_type, tax_category_id, payment_method,
            household_object_id, interval_value, interval_unit, start_date, end_date, next_due_date, autopay,
            notes, created_at, updated_at
       FROM recurring_costs
      ORDER BY description COLLATE NOCASE ASC, id ASC`,
  )
  return rows.map(mapRow)
}

/** Inserts a rule (its first payment is due on the start date) and returns its id. */
export async function insert(values: RecurringCostValues): Promise<number> {
  const result = await execute(
    `INSERT INTO recurring_costs (description, payee, amount_cents, labour_cents, cost_type, tax_category_id,
                                  payment_method, household_object_id, interval_value, interval_unit, start_date,
                                  end_date, autopay, notes, next_due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $11)`,
    toParams(values),
  ).catch(rethrowConstraintError)
  return insertedId(result, 'recurring cost')
}

/**
 * Updates a rule. Payments already recorded stay; the next one is not before the
 * (new) start date. false = no such rule.
 */
export async function update(id: number, values: RecurringCostValues): Promise<boolean> {
  const result = await execute(
    `UPDATE recurring_costs
        SET description = $1,
            payee = $2,
            amount_cents = $3,
            labour_cents = $4,
            cost_type = $5,
            tax_category_id = $6,
            payment_method = $7,
            household_object_id = $8,
            interval_value = $9,
            interval_unit = $10,
            start_date = $11,
            end_date = $12,
            autopay = $13,
            notes = $14,
            next_due_date = max(next_due_date, $11),
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $15`,
    [...toParams(values), id],
  ).catch(rethrowConstraintError)
  return result.rowsAffected > 0
}

/** Deletes a rule; the costs it created stay (ON DELETE SET NULL). false = no such rule. */
export async function remove(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM recurring_costs WHERE id = $1', [id])
  return result.rowsAffected > 0
}

/**
 * Payments of a rule: its `costs` are recorded, and the next payment is due on
 * `nextDueDate`. `dueDate` is the rule's next due date as loaded; if it changed
 * meanwhile (the payment was recorded already), nothing is written.
 */
export interface RulePayments {
  ruleId: number
  dueDate: string
  nextDueDate: string
  costs: readonly CostValues[]
}

/**
 * Moves the rule on, then inserts its costs, but only if the rule was still due on
 * `dueDate`: a payment that was recorded meanwhile (e.g. twice) is not recorded again.
 * `changes()` is the number of rows the previous statement of the transaction changed.
 */
function paymentStatements({ ruleId, dueDate, nextDueDate, costs }: RulePayments): SqlStatement[] {
  return [
    {
      sql: `UPDATE recurring_costs
               SET next_due_date = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
             WHERE id = $2 AND next_due_date = $3`,
      params: [nextDueDate, ruleId, dueDate],
    },
    ...costs.map((cost): SqlStatement => ({
      sql: `INSERT INTO costs (${COST_COLUMNS}, recurring_cost_id)
              SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12 WHERE changes() = 1`,
      params: [...costParams(cost), ruleId],
    })),
  ]
}

/**
 * Records payments of rules in one transaction (all or nothing): confirming one,
 * skipping one (no costs) or the autopay rows of several rules. Returns how many
 * costs were inserted.
 */
export async function recordPayments(payments: readonly RulePayments[]): Promise<number> {
  const results = await transaction(payments.flatMap(paymentStatements)).catch(rethrowConstraintError)
  const updates = payments.flatMap((payment) => [true, ...payment.costs.map(() => false)])
  return results.filter((result, index) => updates[index] === false && result.rowsAffected > 0).length
}
