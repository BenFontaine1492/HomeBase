import { t } from '@/i18n'
import { daysBetween, isValidIsoDate } from '@/utils/date'
import { normaliseText } from '@/utils/text'

export type InvestmentPriority = 'high' | 'medium' | 'low'

export const INVESTMENT_PRIORITIES: readonly InvestmentPriority[] = ['high', 'medium', 'low']

/** Theme status colours of the priorities (see plugins/vuetify.ts): badges, chart bars, the summary bar. */
export const PRIORITY_COLORS: Readonly<Record<InvestmentPriority, 'error' | 'warning' | 'success'>> = {
  high: 'error',
  medium: 'warning',
  low: 'success',
}

/** Must match the CHECK in migration 0008. */
export const INVESTMENT_STATUSES = ['planned', 'purchased'] as const
export type InvestmentStatus = (typeof INVESTMENT_STATUSES)[number]

export function priorityLabel(priority: InvestmentPriority): string {
  return t(`investments.priorities.${priority}`)
}

export function statusLabel(status: InvestmentStatus): string {
  return t(`investments.statuses.${status}`)
}

/** A household investment (a future purchase, or one already bought). */
export interface Investment {
  id: number
  /** The project it belongs to. */
  projectId: number
  title: string
  description: string | null
  /** Estimated cost in cents (integer) to avoid floating point rounding. */
  estimatedCostCents: number
  priority: InvestmentPriority
  /** Position in the priority list of its project's planned investments. */
  sortOrder: number
  status: InvestmentStatus
  /** 'YYYY-MM-DD'; set exactly when the status is 'purchased'. */
  purchasedDate: string | null
  /** 'YYYY-MM-DD': when it should be bought. */
  targetDate: string | null
  /** The most that should be spent, in cents. */
  budgetCents: number | null
  /** Money set aside for it so far, in cents. */
  savedCents: number | null
  createdAt: string
  updatedAt: string
}

/** User-editable fields of an investment, used for both creating and updating. */
export interface InvestmentInput {
  projectId: number
  title: string
  description?: string | null
  estimatedCostCents: number
  priority: InvestmentPriority
  /** Default: 'planned'. */
  status?: InvestmentStatus
  /** Required when purchased; ignored when planned. */
  purchasedDate?: string | null
  targetDate?: string | null
  budgetCents?: number | null
  savedCents?: number | null
}

/** The editable fields of an existing investment, e.g. to change only its status. */
export function investmentInputOf(investment: Investment): InvestmentInput {
  const { projectId, title, description, estimatedCostCents, priority, status, purchasedDate } = investment
  const { targetDate, budgetCents, savedCents } = investment
  return {
    projectId,
    title,
    description,
    estimatedCostCents,
    priority,
    status,
    purchasedDate,
    targetDate,
    budgetCents,
    savedCents,
  }
}

function isAmount(cents: number | null): boolean {
  return cents === null || (Number.isSafeInteger(cents) && cents >= 0)
}

/** Checks a date field; '' or null = none. */
function checkedDate(value: string | null | undefined, message: 'targetDate' | 'purchasedDate'): string | null {
  const date = normaliseText(value)
  if (date !== null && !isValidIsoDate(date)) throw new Error(t(`errors.investment.${message}`))
  return date
}

/**
 * The editable fields of an investment, validated and normalised (value object).
 * Only `InvestmentValues.from()` can create one, so repositories never receive
 * unchecked input.
 */
export class InvestmentValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'InvestmentValues'

  readonly projectId: number
  readonly title: string
  readonly description: string | null
  /** Integer cents, never negative. */
  readonly estimatedCostCents: number
  readonly priority: InvestmentPriority
  readonly status: InvestmentStatus
  /** Set exactly when purchased. */
  readonly purchasedDate: string | null
  readonly targetDate: string | null
  readonly budgetCents: number | null
  readonly savedCents: number | null

  private constructor(fields: Omit<InvestmentValues, 'brand'>) {
    this.projectId = fields.projectId
    this.title = fields.title
    this.description = fields.description
    this.estimatedCostCents = fields.estimatedCostCents
    this.priority = fields.priority
    this.status = fields.status
    this.purchasedDate = fields.purchasedDate
    this.targetDate = fields.targetDate
    this.budgetCents = fields.budgetCents
    this.savedCents = fields.savedCents
  }

  /** Checks the form input and trims it. Throws an error with a readable message. */
  static from(input: InvestmentInput): InvestmentValues {
    const title = input.title.trim()
    if (title.length === 0) throw new Error(t('errors.investment.titleRequired'))
    if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0) {
      throw new Error(t('errors.investment.projectRequired'))
    }
    if (!INVESTMENT_PRIORITIES.includes(input.priority)) {
      throw new Error(t('errors.investment.unknownPriority', { priority: input.priority }))
    }
    return new InvestmentValues({
      projectId: input.projectId,
      title,
      description: normaliseText(input.description),
      priority: input.priority,
      ...checkedAmounts(input),
      ...checkedStatus(input),
      targetDate: checkedDate(input.targetDate, 'targetDate'),
    })
  }
}

function checkedAmounts(
  input: InvestmentInput,
): Pick<InvestmentValues, 'estimatedCostCents' | 'budgetCents' | 'savedCents'> {
  const budgetCents = input.budgetCents ?? null
  const savedCents = input.savedCents ?? null
  if (!isAmount(input.estimatedCostCents)) throw new Error(t('errors.investment.invalidCost'))
  if (!isAmount(budgetCents)) throw new Error(t('errors.investment.invalidBudget'))
  if (!isAmount(savedCents)) throw new Error(t('errors.investment.invalidSaved'))
  return { estimatedCostCents: input.estimatedCostCents, budgetCents, savedCents }
}

/** A purchased investment needs its purchase date; a planned one has none. */
function checkedStatus(input: InvestmentInput): Pick<InvestmentValues, 'status' | 'purchasedDate'> {
  const status = input.status ?? 'planned'
  if (!INVESTMENT_STATUSES.includes(status)) throw new Error(t('errors.investment.unknownStatus'))
  if (status === 'planned') return { status, purchasedDate: null }
  const purchasedDate = checkedDate(input.purchasedDate, 'purchasedDate')
  if (purchasedDate === null) throw new Error(t('errors.investment.purchasedDateRequired'))
  return { status, purchasedDate }
}

/**
 * The new order of the planned investments (value object): their ids, first =
 * most important. Only `InvestmentOrder.from()` can create one.
 */
export class InvestmentOrder {
  declare private readonly brand: 'InvestmentOrder'

  private constructor(readonly ids: readonly number[]) {}

  static from(ids: readonly number[]): InvestmentOrder {
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error(t('errors.investment.invalidOrder'))
    if (new Set(ids).size !== ids.length) throw new Error(t('errors.investment.invalidOrder'))
    return new InvestmentOrder([...ids])
  }
}

/** `ids` with `id` moved to `toIndex` (clamped to the list); unchanged if `id` is not in it. */
export function movedOrder(ids: readonly number[], id: number, toIndex: number): number[] {
  const from = ids.indexOf(id)
  if (from < 0) return [...ids]
  const rest = ids.filter((other) => other !== id)
  const index = Math.min(Math.max(toIndex, 0), rest.length)
  return [...rest.slice(0, index), id, ...rest.slice(index)]
}

/** Planned investments in priority order (sort order, then id); within a project when `projectId` is given. */
export function plannedInvestments(investments: readonly Investment[], projectId?: number): Investment[] {
  return (
    investments
      .filter((investment) => investment.status === 'planned')
      .filter((investment) => projectId === undefined || investment.projectId === projectId)
      // A fresh array from filter(); toSorted() needs lib ES2023 (tsconfig has ES2022).
      // oxlint-disable-next-line unicorn/no-array-sort
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  )
}

/** Purchased investments, most recent purchase first. */
export function purchasedInvestments(investments: readonly Investment[]): Investment[] {
  const dateOf = (investment: Investment): string => investment.purchasedDate ?? ''
  return (
    investments
      .filter((investment) => investment.status === 'purchased')
      // A fresh array from filter(); toSorted() needs lib ES2023 (tsconfig has ES2022).
      // oxlint-disable-next-line unicorn/no-array-sort
      .sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || b.id - a.id)
  )
}

export interface SavingsProgress {
  savedCents: number
  /** The budget if set, else the estimated cost. */
  goalCents: number
  /** 0…1 */
  share: number
  /** Still to save; never negative. */
  remainingCents: number
  /**
   * Needed per month to reach the goal by the target date; null without a
   * target date. A target date this month or earlier needs the whole remainder.
   */
  monthlyCents: number | null
}

/** How far the savings for a planned investment are; null when nothing is being saved. */
export function savingsProgress(investment: Investment, today: string): SavingsProgress | null {
  if (investment.savedCents === null) return null
  const goalCents = investment.budgetCents ?? investment.estimatedCostCents
  const savedCents = investment.savedCents
  const remainingCents = Math.max(goalCents - savedCents, 0)
  const share = goalCents === 0 ? 1 : Math.min(savedCents / goalCents, 1)
  let monthlyCents: number | null = null
  if (investment.targetDate !== null) {
    const months = Math.max(Math.ceil(daysBetween(today, investment.targetDate) / 30.4375), 1)
    monthlyCents = Math.ceil(remainingCents / months)
  }
  return { savedCents, goalCents, share, remainingCents, monthlyCents }
}

/** True when the estimated cost is above the budget. */
export function isOverBudget(investment: Pick<Investment, 'budgetCents' | 'estimatedCostCents'>): boolean {
  return investment.budgetCents !== null && investment.estimatedCostCents > investment.budgetCents
}
