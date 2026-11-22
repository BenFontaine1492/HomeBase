import { t } from '@/i18n'
import { isValidIsoDate } from '@/utils/date'
import { normaliseText } from '@/utils/text'
import {
  checkedId,
  checkedPaymentMethod,
  checkedTaxFields,
  COST_TYPES,
  isAmount,
  type CostInput,
  type CostType,
  type PaymentMethod,
} from './cost'
import { addInterval } from './maintenance-schedule'
import { INTERVAL_UNITS, MAX_INTERVAL_VALUE, type Interval, type IntervalUnit } from './maintenance-task'
import type { TaxCategory } from './tax-category'

/*
 * Rules for recurring costs (insurance, rent, subscriptions, …). A rule suggests
 * each payment when it is due ("paid?"); confirming creates the cost row, with the
 * amount correctable. Autopay rules (e.g. a direct debit) create their rows by
 * themselves. `nextDueDate` is the next payment that isn't recorded yet.
 * Pure: "today" is a parameter.
 */

export interface RecurringCost extends Interval {
  id: number
  description: string
  payee: string | null
  /** Integer cents, the usual amount of one payment. */
  amountCents: number
  labourCents: number | null
  costType: CostType
  taxCategoryId: number | null
  paymentMethod: PaymentMethod | null
  householdObjectId: number | null
  /** 'YYYY-MM-DD', the first payment. */
  startDate: string
  /** 'YYYY-MM-DD', the last possible payment; null = open-ended. */
  endDate: string | null
  /** 'YYYY-MM-DD', the next payment not recorded yet. */
  nextDueDate: string
  /** Rows are created automatically when due. */
  autopay: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** User-editable fields of a rule. */
export interface RecurringCostInput extends Interval {
  description: string
  payee?: string | null
  amountCents: number
  labourCents?: number | null
  costType: CostType
  taxCategoryId: number | null
  paymentMethod?: PaymentMethod | null
  householdObjectId?: number | null
  startDate: string
  endDate?: string | null
  autopay: boolean
  notes?: string | null
}

function checkedInterval({ intervalValue, intervalUnit }: Interval): Interval {
  if (!Number.isSafeInteger(intervalValue) || intervalValue < 1 || intervalValue > MAX_INTERVAL_VALUE) {
    throw new Error(t('errors.task.invalidInterval', { max: MAX_INTERVAL_VALUE }))
  }
  if (!INTERVAL_UNITS.includes(intervalUnit)) throw new Error(t('errors.task.unknownUnit'))
  return { intervalValue, intervalUnit }
}

function checkedDates(input: RecurringCostInput): { startDate: string; endDate: string | null } {
  const startDate = input.startDate.trim()
  if (!isValidIsoDate(startDate)) throw new Error(t('errors.recurringCost.startDate'))
  const endDate = normaliseText(input.endDate)
  if (endDate !== null && (!isValidIsoDate(endDate) || endDate < startDate)) {
    throw new Error(t('errors.recurringCost.endDate'))
  }
  return { startDate, endDate }
}

/** The fields of a rule, validated and normalised (value object). Only `from()` can create one. */
export class RecurringCostValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'RecurringCostValues'

  readonly description: string
  readonly payee: string | null
  readonly amountCents: number
  readonly labourCents: number | null
  readonly costType: CostType
  readonly taxCategoryId: number | null
  readonly paymentMethod: PaymentMethod | null
  readonly householdObjectId: number | null
  readonly intervalValue: number
  readonly intervalUnit: IntervalUnit
  readonly startDate: string
  readonly endDate: string | null
  readonly autopay: boolean
  readonly notes: string | null

  private constructor(fields: Omit<RecurringCostValues, 'brand'>) {
    this.description = fields.description
    this.payee = fields.payee
    this.amountCents = fields.amountCents
    this.labourCents = fields.labourCents
    this.costType = fields.costType
    this.taxCategoryId = fields.taxCategoryId
    this.paymentMethod = fields.paymentMethod
    this.householdObjectId = fields.householdObjectId
    this.intervalValue = fields.intervalValue
    this.intervalUnit = fields.intervalUnit
    this.startDate = fields.startDate
    this.endDate = fields.endDate
    this.autopay = fields.autopay
    this.notes = fields.notes
  }

  /** `category` = the selected tax category (it decides whether the labour share is kept). */
  static from(input: RecurringCostInput, category: TaxCategory | undefined): RecurringCostValues {
    const description = normaliseText(input.description)
    if (description === null) throw new Error(t('errors.cost.descriptionRequired'))
    if (!isAmount(input.amountCents) || input.amountCents === 0) throw new Error(t('errors.recurringCost.amount'))
    if (!(COST_TYPES as readonly string[]).includes(input.costType)) throw new Error(t('errors.cost.unknownType'))
    return new RecurringCostValues({
      description,
      payee: normaliseText(input.payee),
      amountCents: input.amountCents,
      costType: input.costType,
      ...checkedTaxFields(input, input.amountCents, category),
      paymentMethod: checkedPaymentMethod(input.paymentMethod),
      householdObjectId: checkedId(input.householdObjectId),
      ...checkedInterval(input),
      ...checkedDates(input),
      autopay: input.autopay,
      notes: normaliseText(input.notes),
    })
  }
}

/** The form input of an existing rule (for editing it). */
export function inputOfRule(rule: RecurringCost): RecurringCostInput {
  return {
    description: rule.description,
    payee: rule.payee,
    amountCents: rule.amountCents,
    labourCents: rule.labourCents,
    costType: rule.costType,
    taxCategoryId: rule.taxCategoryId,
    paymentMethod: rule.paymentMethod,
    householdObjectId: rule.householdObjectId,
    intervalValue: rule.intervalValue,
    intervalUnit: rule.intervalUnit,
    startDate: rule.startDate,
    endDate: rule.endDate,
    autopay: rule.autopay,
    notes: rule.notes,
  }
}

/** At most this many payments are caught up at once (e.g. a daily rule after a long break). */
export const MAX_CATCH_UP = 120

/** Whether the rule has no further payments (its end date has passed). */
export function isFinished(rule: Pick<RecurringCost, 'nextDueDate' | 'endDate'>): boolean {
  return rule.endDate !== null && rule.nextDueDate > rule.endDate
}

/** What the payment dates of a rule follow from. */
export type RuleSchedule = Interval & Pick<RecurringCost, 'startDate'>

/**
 * Payment `index` (0 = the first) of a rule: counted from the start date, so a rule
 * starting on 31 January is due on 28 February and on 31 March, not on 28 March.
 */
function paymentDate(rule: RuleSchedule, index: number): string {
  return addInterval(rule.startDate, { intervalValue: rule.intervalValue * index, intervalUnit: rule.intervalUnit })
}

/** The index of the first payment after `date`. */
function indexAfter(rule: RuleSchedule, date: string): number {
  let index = 0
  while (paymentDate(rule, index) <= date) index += 1
  return index
}

/** The payment after the one due on `dueDate`. */
export function nextDueAfter(rule: RuleSchedule, dueDate: string): string {
  return paymentDate(rule, indexAfter(rule, dueDate))
}

/** The payments of `rule` due up to `today` (not after its end date), oldest first. */
export function dueDatesOf(rule: RecurringCost, today: string): string[] {
  const dates: string[] = []
  // From the payment on or before the next due date; that one counts if it is the next due date
  // (an edited rule's next due date may lie between two payments).
  for (let index = indexAfter(rule, rule.nextDueDate) - 1; dates.length < MAX_CATCH_UP; index += 1) {
    const date = paymentDate(rule, index)
    if (date > today || (rule.endDate !== null && date > rule.endDate)) break
    if (date >= rule.nextDueDate) dates.push(date)
  }
  return dates
}

/** The cost a payment of `rule` on `paidDate` creates (the form's prefill, or an autopay row). */
export function costInputOfRule(rule: RecurringCost, paidDate: string): CostInput {
  return {
    paidDate,
    amountCents: rule.amountCents,
    labourCents: rule.labourCents,
    costType: rule.costType,
    description: rule.description,
    payee: rule.payee,
    paymentMethod: rule.paymentMethod,
    notes: null,
    taxCategoryId: rule.taxCategoryId,
    householdObjectId: rule.householdObjectId,
  }
}

/** A payment of a rule that is due and not recorded yet. */
export interface DuePayment {
  rule: RecurringCost
  /** The oldest payment of the rule that is due. */
  dueDate: string
  /** How many later payments of the rule are due too (they come next). */
  moreCount: number
}

/**
 * The due payments of the rules that are not autopay, oldest first: one per rule,
 * its oldest. Recording or skipping it moves the rule on to the next.
 */
export function duePayments(rules: readonly RecurringCost[], today: string): DuePayment[] {
  const payments = rules
    .filter((rule) => !rule.autopay)
    .flatMap((rule): DuePayment[] => {
      const [dueDate, ...more] = dueDatesOf(rule, today)
      return dueDate === undefined ? [] : [{ rule, dueDate, moreCount: more.length }]
    })
  // A fresh array from flatMap(); toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  return payments.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.rule.id - b.rule.id)
}

/** The rows an autopay rule creates now, and its next due date after them. */
export interface AutopayRun {
  rule: RecurringCost
  dates: string[]
  nextDueDate: string
}

/** What the autopay rules create as of `today` (rules with nothing due are left out). */
export function autopayRuns(rules: readonly RecurringCost[], today: string): AutopayRun[] {
  return rules
    .filter((rule) => rule.autopay)
    .flatMap((rule): AutopayRun[] => {
      const dates = dueDatesOf(rule, today)
      const last = dates.at(-1)
      return last === undefined ? [] : [{ rule, dates, nextDueDate: nextDueAfter(rule, last) }]
    })
}
