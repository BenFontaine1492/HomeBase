import { t } from '@/i18n'
import * as repository from '@/repositories/recurring-income.repository'
import { IncomeValues, type IncomeInput } from '@/types/income'
import {
  incomeInputOfRule,
  RecurringIncomeValues,
  type DueIncome,
  type RecurringIncome,
  type RecurringIncomeInput,
} from '@/types/recurring-income'
import { autopayRuns, nextDueAfter } from '@/types/recurring-schedule'
import { rethrowWithMessage } from './service-errors'

/*
 * Recurring income: the rules, and recording their payments. Confirming a payment
 * records its income and moves the rule on, in one transaction; autopay rules do
 * that by themselves for every payment that is due.
 */

function messages(): { missingReference: string } {
  return { missingReference: t('errors.gone.incomeReference') }
}

export function listRecurringIncome(): Promise<RecurringIncome[]> {
  return repository.findAll()
}

export async function createRecurringIncome(input: RecurringIncomeInput): Promise<number> {
  return repository.insert(RecurringIncomeValues.from(input)).catch(rethrowWithMessage(messages()))
}

export async function updateRecurringIncome(id: number, input: RecurringIncomeInput): Promise<void> {
  const found = await repository.update(id, RecurringIncomeValues.from(input)).catch(rethrowWithMessage(messages()))
  if (!found) throw new Error(t('errors.gone.recurringIncome'))
}

/** Deletes a rule. The income it recorded stays. */
export async function deleteRecurringIncome(id: number): Promise<void> {
  if (!(await repository.remove(id))) throw new Error(t('errors.gone.recurringIncome'))
}

/** Records the payment as the income `input` (the rule's values, maybe corrected) and moves the rule on. */
export async function confirmReceipt({ rule, dueDate }: DueIncome, input: IncomeInput): Promise<void> {
  const income = IncomeValues.from(input)
  const recorded = await repository
    .recordReceipts([
      { ruleId: rule.id, dueDate: rule.nextDueDate, nextDueDate: nextDueAfter(rule, dueDate), income: [income] },
    ])
    .catch(rethrowWithMessage(messages()))
  if (recorded === 0) throw new Error(t('errors.recurringCost.alreadyRecorded'))
}

/** Moves the rule on without recording the payment (e.g. it didn't come this time). */
export async function skipReceipt({ rule, dueDate }: DueIncome): Promise<void> {
  await repository.recordReceipts([
    { ruleId: rule.id, dueDate: rule.nextDueDate, nextDueDate: nextDueAfter(rule, dueDate), income: [] },
  ])
}

/**
 * Records the income of every autopay payment due up to `today` (catching up
 * missed ones), in one transaction. Returns how many rows were recorded.
 */
export async function createDueAutopayIncome(rules: readonly RecurringIncome[], today: string): Promise<number> {
  const runs = autopayRuns(rules, today)
  if (runs.length === 0) return 0
  return repository.recordReceipts(
    runs.map(({ rule, dates, nextDueDate }) => ({
      ruleId: rule.id,
      dueDate: rule.nextDueDate,
      nextDueDate,
      income: dates.map((date) => IncomeValues.from(incomeInputOfRule(rule, date))),
    })),
  )
}
