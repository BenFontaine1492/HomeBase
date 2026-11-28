import { normaliseText } from '@/utils/text'
import { checkedPaymentMethod, type CostInput, type PaymentMethod } from './cost'

/**
 * The fields of a maintenance record's cost that the Finances page edits. The record
 * owns the date, the amount and the payee ("Mark as done", the maintenance history);
 * the description is optional (the task names the cost).
 */
export type CostDetailsInput = Pick<CostInput, 'category' | 'paymentMethod' | 'notes'> & {
  description?: string | null
}

/** The editable fields of a maintenance record's cost, validated (value object). Only `from()` can create one. */
export class CostDetailsValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'CostDetailsValues'

  readonly category: string | null
  readonly description: string | null
  readonly paymentMethod: PaymentMethod | null
  readonly notes: string | null

  private constructor(fields: Omit<CostDetailsValues, 'brand'>) {
    this.category = fields.category
    this.description = fields.description
    this.paymentMethod = fields.paymentMethod
    this.notes = fields.notes
  }

  static from(input: CostDetailsInput): CostDetailsValues {
    return new CostDetailsValues({
      category: normaliseText(input.category),
      description: normaliseText(input.description),
      paymentMethod: checkedPaymentMethod(input.paymentMethod),
      notes: normaliseText(input.notes),
    })
  }
}
