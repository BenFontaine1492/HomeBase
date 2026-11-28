import { execute, select, transaction, type SqlStatement, type SqlValue } from '@/infrastructure/database'
import { INCOME_COLUMNS, toParams as incomeParams } from './income.repository'
import { insertedId, rethrowConstraintError } from './repository-errors'
import type { PaymentMethod } from '@/types/cost'
import type { IncomeValues } from '@/types/income'
import type { IntervalUnit } from '@/types/maintenance-task'
import type { RecurringIncome, RecurringIncomeValues } from '@/types/recurring-income'

interface RecurringIncomeRow {
  id: number
  description: string
  payer: string | null
  amount_cents: number
  category: string | null
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

function mapRow(row: RecurringIncomeRow): RecurringIncome {
  return {
    id: row.id,
    description: row.description,
    payer: row.payer,
    amountCents: row.amount_cents,
    category: row.category,
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

/** Column values in the order used by INSERT and UPDATE ($1 … $12). */
function toParams(values: RecurringIncomeValues): SqlValue[] {
  return [
    values.description,
    values.payer,
    values.amountCents,
    values.category,
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
export async function findAll(): Promise<RecurringIncome[]> {
  const rows = await select<RecurringIncomeRow>(
    `SELECT id, description, payer, amount_cents, category, payment_method, household_object_id,
            interval_value, interval_unit, start_date, end_date, next_due_date, autopay, notes, created_at, updated_at
       FROM recurring_income
      ORDER BY description COLLATE NOCASE ASC, id ASC`,
  )
  return rows.map(mapRow)
}

/** Inserts a rule (its first payment is due on the start date) and returns its id. */
export async function insert(values: RecurringIncomeValues): Promise<number> {
  const result = await execute(
    `INSERT INTO recurring_income (description, payer, amount_cents, category, payment_method, household_object_id,
                                   interval_value, interval_unit, start_date, end_date, autopay, notes, next_due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $9)`,
    toParams(values),
  ).catch(rethrowConstraintError)
  return insertedId(result, 'recurring income')
}

/**
 * Updates a rule. Payments already recorded stay; the next one is not before the
 * (new) start date. false = no such rule.
 */
export async function update(id: number, values: RecurringIncomeValues): Promise<boolean> {
  const result = await execute(
    `UPDATE recurring_income
        SET description = $1,
            payer = $2,
            amount_cents = $3,
            category = $4,
            payment_method = $5,
            household_object_id = $6,
            interval_value = $7,
            interval_unit = $8,
            start_date = $9,
            end_date = $10,
            autopay = $11,
            notes = $12,
            next_due_date = max(next_due_date, $9),
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $13`,
    [...toParams(values), id],
  ).catch(rethrowConstraintError)
  return result.rowsAffected > 0
}

/** Deletes a rule; the income it recorded stays (ON DELETE SET NULL). false = no such rule. */
export async function remove(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM recurring_income WHERE id = $1', [id])
  return result.rowsAffected > 0
}

/**
 * Payments of a rule: its `income` is recorded, and the next payment is due on
 * `nextDueDate`. `dueDate` is the rule's next due date as loaded; if it changed
 * meanwhile (the payment was recorded already), nothing is written.
 */
export interface RuleReceipts {
  ruleId: number
  dueDate: string
  nextDueDate: string
  income: readonly IncomeValues[]
}

/**
 * Moves the rule on, then inserts its income, but only if the rule was still due on
 * `dueDate` (see recordPayments in recurring-cost.repository.ts).
 */
function receiptStatements({ ruleId, dueDate, nextDueDate, income }: RuleReceipts): SqlStatement[] {
  return [
    {
      sql: `UPDATE recurring_income
               SET next_due_date = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
             WHERE id = $2 AND next_due_date = $3`,
      params: [nextDueDate, ruleId, dueDate],
    },
    ...income.map((entry): SqlStatement => ({
      sql: `INSERT INTO income (${INCOME_COLUMNS}, recurring_income_id)
              SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9 WHERE changes() = 1`,
      params: [...incomeParams(entry), ruleId],
    })),
  ]
}

/**
 * Records payments of rules in one transaction (all or nothing): confirming one,
 * skipping one (no income) or the autopay rows of several rules. Returns how many
 * income rows were inserted.
 */
export async function recordReceipts(receipts: readonly RuleReceipts[]): Promise<number> {
  const results = await transaction(receipts.flatMap(receiptStatements)).catch(rethrowConstraintError)
  const updates = receipts.flatMap((receipt) => [true, ...receipt.income.map(() => false)])
  return results.filter((result, index) => updates[index] === false && result.rowsAffected > 0).length
}
