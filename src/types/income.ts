import { t } from '@/i18n'
import { isValidIsoDate } from '@/utils/date'
import { normaliseText } from '@/utils/text'
import { matchesCategory } from './category'
import { checkedId, checkedPaymentMethod, isAmount, type FinanceFilter, type PaymentMethod } from './cost'

/*
 * Income of the household (e.g. a salary, PV feed-in payments, rent, interest, a
 * refund). Kept like the costs, in a table of its own, with one free-text category
 * (see category.ts).
 */

/**
 * The categories the income forms suggest first (`income.categories.*`, in the UI
 * language); any other text can be entered as well. Migration 0014 names the old
 * income types like these, so they group together.
 */
export const INCOME_CATEGORY_KEYS = ['salary', 'rent', 'solar', 'interest', 'refunds', 'sales', 'other'] as const

export type IncomeCategoryKey = (typeof INCOME_CATEGORY_KEYS)[number]

export function defaultIncomeCategories(): string[] {
  return INCOME_CATEGORY_KEYS.map((key) => t(`income.categories.${key}`))
}

/** One payment the household received. The tax year is the year of `receivedDate`. */
export interface Income {
  id: number
  /** 'YYYY-MM-DD' */
  receivedDate: string
  /** Integer cents. */
  amountCents: number
  description: string
  payer: string | null
  paymentMethod: PaymentMethod | null
  /** Free text; null = no category. */
  category: string | null
  notes: string | null
  householdObjectId: number | null
  /** The recurring income rule that recorded it. */
  recurringIncomeId: number | null
  createdAt: string
  updatedAt: string
}

/** User-editable fields of an income entry, for creating and updating. */
export interface IncomeInput {
  receivedDate: string
  amountCents: number
  description: string
  payer?: string | null
  paymentMethod?: PaymentMethod | null
  category?: string | null
  notes?: string | null
  householdObjectId?: number | null
}

/** The fields of an income entry, validated and normalised (value object). Only `from()` can create one. */
export class IncomeValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'IncomeValues'

  /** 'YYYY-MM-DD' */
  readonly receivedDate: string
  /** Integer cents, never negative. */
  readonly amountCents: number
  readonly description: string
  readonly payer: string | null
  readonly paymentMethod: PaymentMethod | null
  readonly category: string | null
  readonly notes: string | null
  readonly householdObjectId: number | null

  private constructor(fields: Omit<IncomeValues, 'brand'>) {
    this.receivedDate = fields.receivedDate
    this.amountCents = fields.amountCents
    this.description = fields.description
    this.payer = fields.payer
    this.paymentMethod = fields.paymentMethod
    this.category = fields.category
    this.notes = fields.notes
    this.householdObjectId = fields.householdObjectId
  }

  /** Checks the form input. Throws a readable error. */
  static from(input: IncomeInput): IncomeValues {
    const receivedDate = input.receivedDate.trim()
    if (!isValidIsoDate(receivedDate)) throw new Error(t('errors.income.dateRequired'))
    if (!isAmount(input.amountCents)) throw new Error(t('errors.cost.invalidAmount'))
    const description = normaliseText(input.description)
    if (description === null) throw new Error(t('errors.income.descriptionRequired'))
    return new IncomeValues({
      receivedDate,
      amountCents: input.amountCents,
      description,
      payer: normaliseText(input.payer),
      paymentMethod: checkedPaymentMethod(input.paymentMethod),
      category: normaliseText(input.category),
      notes: normaliseText(input.notes),
      householdObjectId: checkedId(input.householdObjectId),
    })
  }
}

/** The form input of an existing income entry (for editing it). */
export function inputOfIncome(income: Income): IncomeInput {
  return {
    receivedDate: income.receivedDate,
    amountCents: income.amountCents,
    description: income.description,
    payer: income.payer,
    paymentMethod: income.paymentMethod,
    category: income.category,
    notes: income.notes,
    householdObjectId: income.householdObjectId,
  }
}

// ---------------------------------------------------------------------------
// Pure helpers for the Finances view
// ---------------------------------------------------------------------------

/** The tax year of an income entry: the year it was received. */
export function incomeYearOf(income: Pick<Income, 'receivedDate'>): number {
  return Number(income.receivedDate.slice(0, 4))
}

export function filterIncome<T extends Income>(income: readonly T[], filter: FinanceFilter): T[] {
  return income.filter(
    (entry) => (filter.year === null || incomeYearOf(entry) === filter.year) && matchesCategory(entry, filter.category),
  )
}

/** The sum of the amounts, in cents. */
export function sumOfIncome(income: readonly Pick<Income, 'amountCents'>[]): number {
  return income.reduce((sum, entry) => sum + entry.amountCents, 0)
}
