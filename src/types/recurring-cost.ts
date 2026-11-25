import { t } from '@/i18n'
import { normaliseText } from '@/utils/text'
import { checkedId, checkedPaymentMethod, isAmount, type CostInput, type PaymentMethod } from './cost'
import type { Interval, IntervalUnit } from './maintenance-task'
import { checkedInterval, checkedRuleDates, type Due, type RecurringRule } from './recurring-schedule'

/*
 * Rules for recurring costs (insurance, rent, subscriptions, …). A rule suggests
 * each payment when it is due ("paid?"); confirming creates the cost row, with the
 * amount correctable. Autopay rules (e.g. a direct debit) create their rows by
 * themselves. The schedule (due dates, autopay) is in recurring-schedule.ts.
 */

export interface RecurringCost extends RecurringRule {
  description: string
  payee: string | null
  /** Integer cents, the usual amount of one payment. */
  amountCents: number
  category: string | null
  paymentMethod: PaymentMethod | null
  householdObjectId: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** User-editable fields of a rule. */
export interface RecurringCostInput extends Interval {
  description: string
  payee?: string | null
  amountCents: number
  category?: string | null
  paymentMethod?: PaymentMethod | null
  householdObjectId?: number | null
  startDate: string
  endDate?: string | null
  autopay: boolean
  notes?: string | null
}

/** The fields of a rule, validated and normalised (value object). Only `from()` can create one. */
export class RecurringCostValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'RecurringCostValues'

  readonly description: string
  readonly payee: string | null
  readonly amountCents: number
  readonly category: string | null
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
    this.category = fields.category
    this.paymentMethod = fields.paymentMethod
    this.householdObjectId = fields.householdObjectId
    this.intervalValue = fields.intervalValue
    this.intervalUnit = fields.intervalUnit
    this.startDate = fields.startDate
    this.endDate = fields.endDate
    this.autopay = fields.autopay
    this.notes = fields.notes
  }

  static from(input: RecurringCostInput): RecurringCostValues {
    const description = normaliseText(input.description)
    if (description === null) throw new Error(t('errors.cost.descriptionRequired'))
    if (!isAmount(input.amountCents) || input.amountCents === 0) throw new Error(t('errors.recurringCost.amount'))
    return new RecurringCostValues({
      description,
      payee: normaliseText(input.payee),
      amountCents: input.amountCents,
      category: normaliseText(input.category),
      paymentMethod: checkedPaymentMethod(input.paymentMethod),
      householdObjectId: checkedId(input.householdObjectId),
      ...checkedInterval(input),
      ...checkedRuleDates(input),
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
    category: rule.category,
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

/** The cost a payment of `rule` on `paidDate` creates (the form's prefill, or an autopay row). */
export function costInputOfRule(rule: RecurringCost, paidDate: string): CostInput {
  return {
    paidDate,
    amountCents: rule.amountCents,
    category: rule.category,
    description: rule.description,
    payee: rule.payee,
    paymentMethod: rule.paymentMethod,
    notes: null,
    householdObjectId: rule.householdObjectId,
  }
}

/** A payment of a rule that is due and not recorded yet. */
export type DuePayment = Due<RecurringCost>
