import { t } from '@/i18n'
import { normaliseText } from '@/utils/text'
import {
  checkedPaymentMethod,
  checkedTaxFields,
  COST_TYPES,
  type CostInput,
  type CostType,
  type PaymentMethod,
} from './cost'
import type { TaxCategory } from './tax-category'

/**
 * The fields of a maintenance record's cost that the Costs page edits. The record
 * owns the date, the amount and the payee ("Mark as done", the maintenance history);
 * the description is optional (the task names the cost).
 */
export type CostDetailsInput = Pick<
  CostInput,
  'costType' | 'labourCents' | 'paymentMethod' | 'notes' | 'taxCategoryId'
> & {
  description?: string | null
}

/** The editable fields of a maintenance record's cost, validated (value object). Only `from()` can create one. */
export class CostDetailsValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'CostDetailsValues'

  readonly costType: CostType
  readonly description: string | null
  /** At most the cost's amount; null unless the tax category records labour costs. */
  readonly labourCents: number | null
  readonly paymentMethod: PaymentMethod | null
  readonly notes: string | null
  readonly taxCategoryId: number | null

  private constructor(fields: Omit<CostDetailsValues, 'brand'>) {
    this.costType = fields.costType
    this.description = fields.description
    this.labourCents = fields.labourCents
    this.paymentMethod = fields.paymentMethod
    this.notes = fields.notes
    this.taxCategoryId = fields.taxCategoryId
  }

  /** `amountCents` is the cost's amount (set by its record); `category` the selected tax category. */
  static from(input: CostDetailsInput, category: TaxCategory | undefined, amountCents: number): CostDetailsValues {
    if (!(COST_TYPES as readonly string[]).includes(input.costType)) throw new Error(t('errors.cost.unknownType'))
    return new CostDetailsValues({
      costType: input.costType,
      description: normaliseText(input.description),
      paymentMethod: checkedPaymentMethod(input.paymentMethod),
      notes: normaliseText(input.notes),
      ...checkedTaxFields(input, amountCents, category),
    })
  }
}
