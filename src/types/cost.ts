import { t } from '@/i18n'
import { isValidIsoDate } from '@/utils/date'
import { normaliseText } from '@/utils/text'
import type { TaxCategory } from './tax-category'

/** What the money was for. Keep in sync with the CHECKs in migration 0009. */
export const COST_TYPES = [
  'maintenance',
  'repair',
  'purchase',
  'insurance',
  'energy',
  'rent',
  'subscription',
  'service',
  'tax',
  'other',
] as const

export type CostType = (typeof COST_TYPES)[number]

/** How it was paid. Keep in sync with the CHECKs in migration 0009. */
export const PAYMENT_METHODS = ['transfer', 'direct-debit', 'card', 'cash', 'other'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const COST_TYPE_ICONS: Readonly<Record<CostType, string>> = {
  maintenance: 'mdi-wrench-outline',
  repair: 'mdi-hammer-wrench',
  purchase: 'mdi-cart-outline',
  insurance: 'mdi-shield-check-outline',
  energy: 'mdi-lightning-bolt-outline',
  rent: 'mdi-home-outline',
  subscription: 'mdi-autorenew',
  service: 'mdi-account-wrench-outline',
  tax: 'mdi-bank-outline',
  other: 'mdi-cash',
}

export function costTypeLabel(type: CostType): string {
  return t(`costs.types.${type}`)
}

export function paymentMethodLabel(method: PaymentMethod): string {
  return t(`costs.paymentMethods.${method}`)
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
  /** The labour share of the amount, in cents (only asked for some tax categories). */
  labourCents: number | null
  costType: CostType
  /** null only for the cost of a maintenance record (its task or object names it). */
  description: string | null
  payee: string | null
  paymentMethod: PaymentMethod | null
  notes: string | null
  taxCategoryId: number | null
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
  labourCents?: number | null
  costType: CostType
  description: string
  payee?: string | null
  paymentMethod?: PaymentMethod | null
  notes?: string | null
  taxCategoryId: number | null
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

/**
 * The labour share, checked against the amount. null when the category doesn't
 * record labour costs (the form hides the field then, an old value is dropped).
 */
export function checkedLabour(
  labourCents: number | null | undefined,
  amountCents: number,
  category: TaxCategory | undefined,
): number | null {
  const labour = labourCents ?? null
  if (labour === null || category?.recordsLabourCost !== true) return null
  if (!isAmount(labour) || labour > amountCents) throw new Error(t('errors.cost.invalidLabour'))
  return labour
}

export function checkedPaymentMethod(method: PaymentMethod | null | undefined): PaymentMethod | null {
  if (method === null || method === undefined) return null
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) throw new Error(t('errors.cost.unknownPaymentMethod'))
  return method
}

/** The tax category id; `category` must be that category (undefined = it was deleted). */
export function checkedTaxCategory(id: number | null, category: TaxCategory | undefined): number | null {
  const checked = checkedId(id)
  if (checked !== null && category?.id !== checked) throw new Error(t('errors.gone.taxCategory'))
  return checked
}

/** The tax fields of a cost or a rule, as entered. */
export interface TaxFieldsInput {
  costType: CostType
  taxCategoryId: number | null
  labourCents?: number | null
}

/**
 * The tax category and the labour share, checked. A cost of type 'tax' has neither:
 * taxes and fees are a group of their own for the tax advisor (see `taxGroupOf`).
 */
export function checkedTaxFields(
  input: TaxFieldsInput,
  amountCents: number,
  category: TaxCategory | undefined,
): { taxCategoryId: number | null; labourCents: number | null } {
  if (input.costType === 'tax') return { taxCategoryId: null, labourCents: null }
  return {
    taxCategoryId: checkedTaxCategory(input.taxCategoryId, category),
    labourCents: checkedLabour(input.labourCents, amountCents, category),
  }
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
  /** At most the amount; null unless the tax category records labour costs. */
  readonly labourCents: number | null
  readonly costType: CostType
  readonly description: string
  readonly payee: string | null
  readonly paymentMethod: PaymentMethod | null
  readonly notes: string | null
  /** null for costs of type 'tax' (they are a group of their own). */
  readonly taxCategoryId: number | null
  /** At most one of the two links is set. */
  readonly householdObjectId: number | null
  readonly investmentId: number | null

  private constructor(fields: Omit<CostValues, 'brand'>) {
    this.paidDate = fields.paidDate
    this.amountCents = fields.amountCents
    this.labourCents = fields.labourCents
    this.costType = fields.costType
    this.description = fields.description
    this.payee = fields.payee
    this.paymentMethod = fields.paymentMethod
    this.notes = fields.notes
    this.taxCategoryId = fields.taxCategoryId
    this.householdObjectId = fields.householdObjectId
    this.investmentId = fields.investmentId
  }

  /**
   * Checks the form input. `category` is the selected tax category (undefined for
   * none); it decides whether the labour share is kept. Throws a readable error.
   */
  static from(input: CostInput, category: TaxCategory | undefined): CostValues {
    const paidDate = input.paidDate.trim()
    if (!isValidIsoDate(paidDate)) throw new Error(t('errors.cost.dateRequired'))
    if (!isAmount(input.amountCents)) throw new Error(t('errors.cost.invalidAmount'))
    if (!(COST_TYPES as readonly string[]).includes(input.costType)) throw new Error(t('errors.cost.unknownType'))
    const description = normaliseText(input.description)
    if (description === null) throw new Error(t('errors.cost.descriptionRequired'))
    return new CostValues({
      paidDate,
      amountCents: input.amountCents,
      costType: input.costType,
      description,
      payee: normaliseText(input.payee),
      paymentMethod: checkedPaymentMethod(input.paymentMethod),
      notes: normaliseText(input.notes),
      ...checkedTaxFields(input, input.amountCents, category),
      ...checkedLinks(input),
    })
  }
}

/** The form input of an existing cost (for editing it). */
export function inputOfCost(cost: Cost): CostInput {
  return {
    paidDate: cost.paidDate,
    amountCents: cost.amountCents,
    labourCents: cost.labourCents,
    costType: cost.costType,
    description: cost.description ?? '',
    payee: cost.payee,
    paymentMethod: cost.paymentMethod,
    notes: cost.notes,
    taxCategoryId: cost.taxCategoryId,
    householdObjectId: cost.householdObjectId,
    investmentId: cost.investmentId,
  }
}

// ---------------------------------------------------------------------------
// Pure helpers for the Costs view
// ---------------------------------------------------------------------------

/** The tax year of a cost: the year it was paid. */
export function taxYearOf(cost: Pick<Cost, 'paidDate'>): number {
  return Number(cost.paidDate.slice(0, 4))
}

/** The years that have costs, newest first; always includes `currentYear`. */
export function availableYears(costs: readonly Pick<Cost, 'paidDate'>[], currentYear: number): number[] {
  const years = new Set([currentYear, ...costs.map(taxYearOf)])
  // Sorts a fresh copy; toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...years].sort((a, b) => b - a)
}

/** The group of the costs of type 'tax' ("Taxes and fees"); they have no tax category. */
export const TAXES = 'taxes'

/** How a cost is grouped for the tax advisor: its tax category id, TAXES, or null (neither). */
export type TaxGroup = number | typeof TAXES | null

export function taxGroupOf(cost: Pick<Cost, 'costType' | 'taxCategoryId'>): TaxGroup {
  return cost.costType === 'tax' ? TAXES : cost.taxCategoryId
}

/** The name of the TAXES group: the label of the cost type. */
export function taxesGroupLabel(): string {
  return costTypeLabel('tax')
}

/** A tax group, or 'none' = the costs in neither a tax category nor TAXES. */
export type TaxCategoryFilter = number | typeof TAXES | 'none' | null

export interface CostFilter {
  /** null = every year. */
  year: number | null
  costType: CostType | null
  taxCategoryId: TaxCategoryFilter
}

export function filterCosts<T extends Cost>(costs: readonly T[], filter: CostFilter): T[] {
  return costs.filter(
    (cost) =>
      (filter.year === null || taxYearOf(cost) === filter.year) &&
      (filter.costType === null || cost.costType === filter.costType) &&
      (filter.taxCategoryId === null ||
        taxGroupOf(cost) === (filter.taxCategoryId === 'none' ? null : filter.taxCategoryId)),
  )
}

export interface CostTotal {
  /** A tax category id, TAXES, or null = neither (always last). */
  group: TaxGroup
  label: string
  count: number
  amountCents: number
  labourCents: number
}

function emptyTotal(group: TaxGroup, label: string): CostTotal {
  return { group, label, count: 0, amountCents: 0, labourCents: 0 }
}

/**
 * Totals per tax category in the categories' order, then the taxes and fees, then
 * the costs in neither (also those of a deleted category). Empty groups are left out.
 */
export function totalsByTaxCategory(costs: readonly Cost[], categories: readonly TaxCategory[]): CostTotal[] {
  const totals = [
    ...categories.map((category) => emptyTotal(category.id, category.name)),
    emptyTotal(TAXES, taxesGroupLabel()),
  ]
  const without = emptyTotal(null, t('costs.noTaxCategory'))
  for (const cost of costs) {
    const group = taxGroupOf(cost)
    const total = totals.find((candidate) => candidate.group === group) ?? without
    total.count += 1
    total.amountCents += cost.amountCents
    total.labourCents += cost.labourCents ?? 0
  }
  return [...totals, without].filter((total) => total.count > 0)
}

/** The sum of the amounts, in cents. */
export function sumOfCosts(costs: readonly Pick<Cost, 'amountCents'>[]): number {
  return costs.reduce((sum, cost) => sum + cost.amountCents, 0)
}
