import { normaliseText } from '@/utils/text'

export type InvestmentPriority = 'high' | 'medium' | 'low'

export const INVESTMENT_PRIORITIES: readonly InvestmentPriority[] = ['high', 'medium', 'low']

/** A planned household investment as used throughout the application. */
export interface Investment {
  id: number
  title: string
  description: string | null
  /** Estimated cost in cents (integer) to avoid floating point rounding. */
  estimatedCostCents: number
  priority: InvestmentPriority
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** User-editable fields of an investment, used for both creating and updating. */
export interface InvestmentInput {
  title: string
  description?: string | null
  estimatedCostCents: number
  priority: InvestmentPriority
}

/**
 * The editable fields of an investment, validated and normalised (value object).
 * Only `InvestmentValues.from()` can create one, so repositories never receive
 * unchecked input.
 */
export class InvestmentValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'InvestmentValues'

  private constructor(
    readonly title: string,
    readonly description: string | null,
    /** Integer cents, never negative. */
    readonly estimatedCostCents: number,
    readonly priority: InvestmentPriority,
  ) {}

  /** Checks the form input and trims it. Throws an error with a readable message. */
  static from(input: InvestmentInput): InvestmentValues {
    const title = input.title.trim()
    if (title.length === 0) {
      throw new Error('An investment needs a title.')
    }
    if (!Number.isSafeInteger(input.estimatedCostCents) || input.estimatedCostCents < 0) {
      throw new Error('The estimated cost must be a non-negative amount.')
    }
    if (!INVESTMENT_PRIORITIES.includes(input.priority)) {
      throw new Error(`Unknown priority "${input.priority}".`)
    }
    return new InvestmentValues(title, normaliseText(input.description), input.estimatedCostCents, input.priority)
  }
}
