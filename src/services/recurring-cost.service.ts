import { t } from '@/i18n'
import * as repository from '@/repositories/recurring-cost.repository'
import { CostValues, type CostInput } from '@/types/cost'
import {
  costInputOfRule,
  RecurringCostValues,
  type DuePayment,
  type RecurringCost,
  type RecurringCostInput,
} from '@/types/recurring-cost'
import { autopayRuns, nextDueAfter } from '@/types/recurring-schedule'
import { rethrowWithMessage } from './service-errors'

/*
 * Recurring costs: the rules, and recording their payments. Confirming a payment
 * creates its cost and moves the rule on, in one transaction; autopay rules do
 * that by themselves for every payment that is due.
 */

function messages(): { missingReference: string } {
  return { missingReference: t('errors.gone.costReference') }
}

export function listRecurringCosts(): Promise<RecurringCost[]> {
  return repository.findAll()
}

export async function createRecurringCost(input: RecurringCostInput): Promise<number> {
  return repository.insert(RecurringCostValues.from(input)).catch(rethrowWithMessage(messages()))
}

export async function updateRecurringCost(id: number, input: RecurringCostInput): Promise<void> {
  const found = await repository.update(id, RecurringCostValues.from(input)).catch(rethrowWithMessage(messages()))
  if (!found) throw new Error(t('errors.gone.recurringCost'))
}

/** Deletes a rule. The costs it created stay. */
export async function deleteRecurringCost(id: number): Promise<void> {
  if (!(await repository.remove(id))) throw new Error(t('errors.gone.recurringCost'))
}

/** Records the payment as the cost `input` (the rule's values, maybe corrected) and moves the rule on. */
export async function confirmPayment({ rule, dueDate }: DuePayment, input: CostInput): Promise<void> {
  const cost = CostValues.from(input)
  const recorded = await repository
    .recordPayments([
      { ruleId: rule.id, dueDate: rule.nextDueDate, nextDueDate: nextDueAfter(rule, dueDate), costs: [cost] },
    ])
    .catch(rethrowWithMessage(messages()))
  if (recorded === 0) throw new Error(t('errors.recurringCost.alreadyRecorded'))
}

/** Moves the rule on without recording the payment (e.g. it wasn't paid this time). */
export async function skipPayment({ rule, dueDate }: DuePayment): Promise<void> {
  await repository.recordPayments([
    { ruleId: rule.id, dueDate: rule.nextDueDate, nextDueDate: nextDueAfter(rule, dueDate), costs: [] },
  ])
}

/**
 * Creates the cost rows of every autopay payment due up to `today` (catching up
 * missed ones), in one transaction. Returns how many costs were created.
 */
export async function createDueAutopayCosts(rules: readonly RecurringCost[], today: string): Promise<number> {
  const runs = autopayRuns(rules, today)
  if (runs.length === 0) return 0
  return repository.recordPayments(
    runs.map(({ rule, dates, nextDueDate }) => ({
      ruleId: rule.id,
      dueDate: rule.nextDueDate,
      nextDueDate,
      costs: dates.map((date) => CostValues.from(costInputOfRule(rule, date))),
    })),
  )
}
