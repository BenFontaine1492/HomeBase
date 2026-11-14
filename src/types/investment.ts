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
