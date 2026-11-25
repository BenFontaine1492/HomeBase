import { t } from '@/i18n'
import { isValidIsoDate } from '@/utils/date'
import { normaliseText } from '@/utils/text'
import { matchesCategory, type CategoryFilter } from './category'

/** How it was paid (or received). Keep in sync with the CHECKs in migrations 0013 and 0014. */
export const PAYMENT_METHODS = ['transfer', 'direct-debit', 'card', 'cash', 'other'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export function paymentMethodLabel(method: PaymentMethod): string {
  return t(`costs.paymentMethods.${method}`)
}

/**
 * The categories the cost forms suggest first (`costs.categories.*`, in the UI
 * language); any other text can be entered as well. Migration 0014 names the old
 * cost types and tax categories like these, so they group together.
 */
export const COST_CATEGORY_KEYS = [
  'maintenance',
  'repair',
  'tradesmen',
  'householdServices',
  'service',
  'purchase',
  'insurance',
  'energy',
  'rent',
  'subscription',
  'taxes',
  'donations',
  'medical',
  'childcare',
  'homeOffice',
  'other',
] as const

export type CostCategoryKey = (typeof COST_CATEGORY_KEYS)[number]

export function costCategoryName(key: CostCategoryKey): string {
  return t(`costs.categories.${key}`)
}

export function defaultCostCategories(): string[] {
  return COST_CATEGORY_KEYS.map(costCategoryName)
}

/**
 * One payment of the household. The tax year is the year of `paidDate`.
 * Receipts are attachments of the cost.
 */
export interface Cost {
  id: number
  /** 'YYYY-MM-DD' */
  paidDate: string
  /** Integer cents. */
  amountCents: number
  /** Free text (see category.ts); null = no category. */
  category: string | null
  /** null only for the cost of a maintenance record (its task or object names it). */
  description: string | null
  payee: string | null
  paymentMethod: PaymentMethod | null
  notes: string | null
  /** The object the cost is linked to directly. */
  householdObjectId: number | null
  maintenanceRecordId: number | null
  investmentId: number | null
  /** The recurring cost rule that created it. */
  recurringCostId: number | null
  /** The object it belongs to: the direct link, or the object of its maintenance record. */
  objectId: number | null
  createdAt: string
  updatedAt: string
}

/** User-editable fields of a cost, for creating and updating. */
export interface CostInput {
  paidDate: string
  amountCents: number
  category?: string | null
  description: string
  payee?: string | null
  paymentMethod?: PaymentMethod | null
  notes?: string | null
  householdObjectId?: number | null
  investmentId?: number | null
}

export function isAmount(cents: number): boolean {
  return Number.isSafeInteger(cents) && cents >= 0
}

export function checkedId(id: number | null | undefined): number | null {
  if (id === null || id === undefined) return null
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(t('errors.cost.invalidLink'))
  return id
}

export function checkedPaymentMethod(method: PaymentMethod | null | undefined): PaymentMethod | null {
  if (method === null || method === undefined) return null
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) throw new Error(t('errors.cost.unknownPaymentMethod'))
  return method
}

function checkedLinks(input: CostInput): { householdObjectId: number | null; investmentId: number | null } {
  const householdObjectId = checkedId(input.householdObjectId)
  const investmentId = checkedId(input.investmentId)
  if (householdObjectId !== null && investmentId !== null) throw new Error(t('errors.cost.oneLink'))
  return { householdObjectId, investmentId }
}

/** The fields of a cost, validated and normalised (value object). Only `from()` can create one. */
export class CostValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'CostValues'

  /** 'YYYY-MM-DD' */
  readonly paidDate: string
  /** Integer cents, never negative. */
  readonly amountCents: number
  readonly category: string | null
  readonly description: string
  readonly payee: string | null
  readonly paymentMethod: PaymentMethod | null
  readonly notes: string | null
  /** At most one of the two links is set. */
  readonly householdObjectId: number | null
  readonly investmentId: number | null

  private constructor(fields: Omit<CostValues, 'brand'>) {
    this.paidDate = fields.paidDate
    this.amountCents = fields.amountCents
    this.category = fields.category
    this.description = fields.description
    this.payee = fields.payee
    this.paymentMethod = fields.paymentMethod
    this.notes = fields.notes
    this.householdObjectId = fields.householdObjectId
    this.investmentId = fields.investmentId
  }

  /** Checks the form input. Throws a readable error. */
  static from(input: CostInput): CostValues {
    const paidDate = input.paidDate.trim()
    if (!isValidIsoDate(paidDate)) throw new Error(t('errors.cost.dateRequired'))
    if (!isAmount(input.amountCents)) throw new Error(t('errors.cost.invalidAmount'))
    const description = normaliseText(input.description)
    if (description === null) throw new Error(t('errors.cost.descriptionRequired'))
    return new CostValues({
      paidDate,
      amountCents: input.amountCents,
      category: normaliseText(input.category),
      description,
      payee: normaliseText(input.payee),
      paymentMethod: checkedPaymentMethod(input.paymentMethod),
      notes: normaliseText(input.notes),
      ...checkedLinks(input),
    })
  }
}

/** The form input of an existing cost (for editing it). */
export function inputOfCost(cost: Cost): CostInput {
  return {
    paidDate: cost.paidDate,
    amountCents: cost.amountCents,
    category: cost.category,
    description: cost.description ?? '',
    payee: cost.payee,
    paymentMethod: cost.paymentMethod,
    notes: cost.notes,
    householdObjectId: cost.householdObjectId,
    investmentId: cost.investmentId,
  }
}

// ---------------------------------------------------------------------------
// Pure helpers for the Finances view
// ---------------------------------------------------------------------------

/** The tax year of a cost: the year it was paid. */
export function taxYearOf(cost: Pick<Cost, 'paidDate'>): number {
  return Number(cost.paidDate.slice(0, 4))
}

/** The years of `dates` ('YYYY-MM-DD', e.g. of costs and income), newest first; always includes `currentYear`. */
export function availableYears(dates: readonly string[], currentYear: number): number[] {
  const years = new Set([currentYear, ...dates.map((date) => Number(date.slice(0, 4)))])
  // Sorts a fresh copy; toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...years].sort((a, b) => b - a)
}

/** The filters of a list of costs or income: year and category. */
export interface FinanceFilter {
  /** null = every year. */
  year: number | null
  category: CategoryFilter
}

export function filterCosts<T extends Cost>(costs: readonly T[], filter: FinanceFilter): T[] {
  return costs.filter(
    (cost) => (filter.year === null || taxYearOf(cost) === filter.year) && matchesCategory(cost, filter.category),
  )
}

/** The sum of the amounts, in cents. */
export function sumOfCosts(costs: readonly Pick<Cost, 'amountCents'>[]): number {
  return costs.reduce((sum, cost) => sum + cost.amountCents, 0)
}
