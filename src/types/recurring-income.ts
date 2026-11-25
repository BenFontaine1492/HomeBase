import { t } from '@/i18n'
import { normaliseText } from '@/utils/text'
import { checkedId, checkedPaymentMethod, isAmount, type PaymentMethod } from './cost'
import type { IncomeInput } from './income'
import type { Interval, IntervalUnit } from './maintenance-task'
import { checkedInterval, checkedRuleDates, type Due, type RecurringRule } from './recurring-schedule'

/*
 * Rules for recurring income (a salary, rent, PV feed-in payments, interest, …). Like the
 * recurring costs: a rule suggests each payment when it is due ("received?");
 * confirming records the income row, with the amount correctable. Autopay rules
 * record their rows by themselves. The schedule is in recurring-schedule.ts.
 */

export interface RecurringIncome extends RecurringRule {
  description: string
  payer: string | null
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
export interface RecurringIncomeInput extends Interval {
  description: string
  payer?: string | null
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
export class RecurringIncomeValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'RecurringIncomeValues'

  readonly description: string
  readonly payer: string | null
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

  private constructor(fields: Omit<RecurringIncomeValues, 'brand'>) {
    this.description = fields.description
    this.payer = fields.payer
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

  static from(input: RecurringIncomeInput): RecurringIncomeValues {
    const description = normaliseText(input.description)
    if (description === null) throw new Error(t('errors.income.descriptionRequired'))
    if (!isAmount(input.amountCents) || input.amountCents === 0) throw new Error(t('errors.recurringCost.amount'))
    return new RecurringIncomeValues({
      description,
      payer: normaliseText(input.payer),
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
export function inputOfIncomeRule(rule: RecurringIncome): RecurringIncomeInput {
  return {
    description: rule.description,
    payer: rule.payer,
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

/** The income a payment of `rule` on `receivedDate` records (the form's prefill, or an autopay row). */
export function incomeInputOfRule(rule: RecurringIncome, receivedDate: string): IncomeInput {
  return {
    receivedDate,
    amountCents: rule.amountCents,
    description: rule.description,
    payer: rule.payer,
    paymentMethod: rule.paymentMethod,
    category: rule.category,
    notes: null,
    householdObjectId: rule.householdObjectId,
  }
}

/** A payment of a rule that is due and not recorded yet. */
export type DueIncome = Due<RecurringIncome>
