import { t } from '@/i18n'
import { isValidIsoDate } from '@/utils/date'
import { normaliseText } from '@/utils/text'
import { addInterval } from './maintenance-schedule'
import { INTERVAL_UNITS, MAX_INTERVAL_VALUE, type Interval } from './maintenance-task'

/*
 * The schedule of a recurring rule (recurring costs and recurring income): when
 * its occurrences are due, which are due now, and what autopay records. Dates are
 * counted from the start date, so month ends stay. `nextDueDate` is the next
 * occurrence that isn't recorded yet. Pure: "today" is a parameter.
 */

/** What every recurring rule has. */
export interface RecurringRule extends Interval {
  id: number
  /** 'YYYY-MM-DD', the first occurrence. */
  startDate: string
  /** 'YYYY-MM-DD', the last possible occurrence; null = open-ended. */
  endDate: string | null
  /** 'YYYY-MM-DD', the next occurrence not recorded yet. */
  nextDueDate: string
  /** Rows are recorded automatically when due. */
  autopay: boolean
}

/** At most this many occurrences are caught up at once (e.g. a daily rule after a long break). */
export const MAX_CATCH_UP = 120

export function checkedInterval({ intervalValue, intervalUnit }: Interval): Interval {
  if (!Number.isSafeInteger(intervalValue) || intervalValue < 1 || intervalValue > MAX_INTERVAL_VALUE) {
    throw new Error(t('errors.task.invalidInterval', { max: MAX_INTERVAL_VALUE }))
  }
  if (!INTERVAL_UNITS.includes(intervalUnit)) throw new Error(t('errors.task.unknownUnit'))
  return { intervalValue, intervalUnit }
}

/** The start and end date of a rule, as entered (the end date is optional). */
export function checkedRuleDates(input: { startDate: string; endDate?: string | null }): {
  startDate: string
  endDate: string | null
} {
  const startDate = input.startDate.trim()
  if (!isValidIsoDate(startDate)) throw new Error(t('errors.recurringCost.startDate'))
  const endDate = normaliseText(input.endDate)
  if (endDate !== null && (!isValidIsoDate(endDate) || endDate < startDate)) {
    throw new Error(t('errors.recurringCost.endDate'))
  }
  return { startDate, endDate }
}

/** Whether the rule has no further occurrences (its end date has passed). */
export function isFinished(rule: Pick<RecurringRule, 'nextDueDate' | 'endDate'>): boolean {
  return rule.endDate !== null && rule.nextDueDate > rule.endDate
}

/** What the dates of a rule follow from. */
export type RuleSchedule = Interval & Pick<RecurringRule, 'startDate'>

/**
 * Occurrence `index` (0 = the first) of a rule: counted from the start date, so a rule
 * starting on 31 January is due on 28 February and on 31 March, not on 28 March.
 */
function occurrenceDate(rule: RuleSchedule, index: number): string {
  return addInterval(rule.startDate, { intervalValue: rule.intervalValue * index, intervalUnit: rule.intervalUnit })
}

/** The index of the first occurrence after `date`. */
function indexAfter(rule: RuleSchedule, date: string): number {
  let index = 0
  while (occurrenceDate(rule, index) <= date) index += 1
  return index
}

/** The occurrence after the one due on `dueDate`. */
export function nextDueAfter(rule: RuleSchedule, dueDate: string): string {
  return occurrenceDate(rule, indexAfter(rule, dueDate))
}

/** The occurrences of `rule` not recorded yet, up to `until` (not after its end date), oldest first; at most `limit`. */
function openDatesOf(rule: RecurringRule, until: string, limit: number): string[] {
  const dates: string[] = []
  // From the occurrence on or before the next due date; that one counts if it is the next due date
  // (an edited rule's next due date may lie between two occurrences).
  for (let index = indexAfter(rule, rule.nextDueDate) - 1; dates.length < limit; index += 1) {
    const date = occurrenceDate(rule, index)
    if (date > until || (rule.endDate !== null && date > rule.endDate)) break
    if (date >= rule.nextDueDate) dates.push(date)
  }
  return dates
}

/** The occurrences of `rule` due up to `today` (not after its end date), oldest first. */
export function dueDatesOf(rule: RecurringRule, today: string): string[] {
  return openDatesOf(rule, today, MAX_CATCH_UP)
}

/**
 * Every occurrence of `rule` not recorded yet, up to `until` (not after its end date),
 * oldest first: also the overdue ones. For projections into the future.
 */
export function openOccurrencesUntil(rule: RecurringRule, until: string): string[] {
  return openDatesOf(rule, until, Number.POSITIVE_INFINITY)
}

/** An occurrence of a rule that is due and not recorded yet. */
export interface Due<R extends RecurringRule> {
  rule: R
  /** The oldest occurrence of the rule that is due. */
  dueDate: string
  /** How many later occurrences of the rule are due too (they come next). */
  moreCount: number
}

/**
 * The due occurrences of the rules that are not autopay, oldest first: one per rule,
 * its oldest. Recording or skipping it moves the rule on to the next.
 */
export function dueOccurrences<R extends RecurringRule>(rules: readonly R[], today: string): Due<R>[] {
  const due = rules
    .filter((rule) => !rule.autopay)
    .flatMap((rule): Due<R>[] => {
      const [dueDate, ...more] = dueDatesOf(rule, today)
      return dueDate === undefined ? [] : [{ rule, dueDate, moreCount: more.length }]
    })
  // A fresh array from flatMap(); toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  return due.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.rule.id - b.rule.id)
}

/** The rows an autopay rule records now, and its next due date after them. */
export interface AutopayRun<R extends RecurringRule> {
  rule: R
  dates: string[]
  nextDueDate: string
}

/** What the autopay rules record as of `today` (rules with nothing due are left out). */
export function autopayRuns<R extends RecurringRule>(rules: readonly R[], today: string): AutopayRun<R>[] {
  return rules
    .filter((rule) => rule.autopay)
    .flatMap((rule): AutopayRun<R>[] => {
      const dates = dueDatesOf(rule, today)
      const last = dates.at(-1)
      return last === undefined ? [] : [{ rule, dates, nextDueDate: nextDueAfter(rule, last) }]
    })
}
