import { addToIsoDate } from '@/utils/date'
import { plannedInvestments, type Investment, type InvestmentPriority } from './investment'
import { sortedProjects, type Project } from './project'
import { openOccurrencesUntil, type RecurringRule } from './recurring-schedule'

/*
 * The savings roadmap of the Projects page: when the planned investments become
 * affordable from the recurring net income (recurring income − recurring costs),
 * each on its exact due dates. One-off income and costs and account balances are
 * not part of it; the balance starts at 0 today. The projects are funded in their
 * order, their investments in their priority order; each project also gets the
 * date it would be done if it were the only one. Pure: "today" is a parameter.
 */

/** How far ahead the roadmap looks; later dates count as "not reachable". */
export const ROADMAP_YEARS = 30

/** A recurring rule with its usual amount (recurring income or a recurring cost). */
export type AmountRule = RecurringRule & { amountCents: number }

/** The net of the recurring payments on one day, in cents. */
export interface CashFlow {
  date: string
  amountCents: number
}

/**
 * The net per day of the recurring income (+) and costs (−) from `today` up to `until`,
 * oldest first. Occurrences that are due but not recorded yet count on `today`.
 */
export function projectedFlows(
  incomeRules: readonly AmountRule[],
  costRules: readonly AmountRule[],
  today: string,
  until: string,
): CashFlow[] {
  const byDate = new Map<string, number>()
  const add = (rule: AmountRule, sign: 1 | -1): void => {
    for (const occurrence of openOccurrencesUntil(rule, until)) {
      const date = occurrence < today ? today : occurrence
      byDate.set(date, (byDate.get(date) ?? 0) + sign * rule.amountCents)
    }
  }
  for (const rule of incomeRules) add(rule, 1)
  for (const rule of costRules) add(rule, -1)
  return (
    [...byDate]
      .map(([date, amountCents]) => ({ date, amountCents }))
      // A fresh array from map(); toSorted() needs lib ES2023 (tsconfig has ES2022).
      // oxlint-disable-next-line unicorn/no-array-sort
      .sort((a, b) => a.date.localeCompare(b.date))
  )
}

/** What a planned investment still needs: its estimated cost minus the amount saved for it, never negative. */
export function neededCents(investment: Pick<Investment, 'estimatedCostCents' | 'savedCents'>): number {
  return Math.max(investment.estimatedCostCents - (investment.savedCents ?? 0), 0)
}

/**
 * The date each of `amounts` (in funding order) becomes affordable: the first day the
 * running balance of `flows`, starting at 0 on `today`, covers it and all before it.
 * null = not within the flows.
 */
export function fundingDates(flows: readonly CashFlow[], amounts: readonly number[], today: string): (string | null)[] {
  let balance = 0
  let date = today
  let next = 0
  let needed = 0
  return amounts.map((amount) => {
    needed += amount
    for (; balance < needed && next < flows.length; next += 1) {
      const flow = flows[next]!
      balance += flow.amountCents
      date = flow.date
    }
    return balance >= needed ? date : null
  })
}

/** A point of the projected balance: the balance after the payments of `date`. */
export interface BalancePoint {
  date: string
  balanceCents: number
}

/** The running balance of `flows`, starting at 0 on `today` (the first point). */
export function balanceSteps(flows: readonly CashFlow[], today: string): BalancePoint[] {
  let balanceCents = 0
  const steps: BalancePoint[] = [{ date: today, balanceCents }]
  for (const flow of flows) {
    balanceCents += flow.amountCents
    if (flow.date === today) steps[0] = { date: today, balanceCents }
    else steps.push({ date: flow.date, balanceCents })
  }
  return steps
}

/** The average net per month of the flows in the 12 months from `today`, in cents. */
export function averageMonthlyNetCents(flows: readonly CashFlow[], today: string): number {
  const end = addToIsoDate(today, { months: 12 })
  const sum = flows.filter((flow) => flow.date < end).reduce((total, flow) => total + flow.amountCents, 0)
  return Math.round(sum / 12)
}

export interface InvestmentForecast {
  investment: Investment
  neededCents: number
  /** When it is affordable with all projects in their order; null = not reachable. */
  date: string | null
  /** When it is affordable with only its own project; null = not reachable. */
  aloneDate: string | null
}

export interface ProjectForecast {
  project: Project
  /** Its planned investments in priority order. */
  investments: InvestmentForecast[]
  /** Estimated cost of its planned investments. */
  totalCents: number
  /** What they still need (minus the saved amounts). */
  neededCents: number
  /** When saving for it starts with all projects in their order (the projects before it are done); null = never. */
  startDate: string | null
  /** When it is done with all projects in their order; null = not reachable or nothing planned. */
  date: string | null
  /** When it would be done as the only project; null = not reachable or nothing planned. */
  aloneDate: string | null
}

export interface Roadmap {
  projects: ProjectForecast[]
  /** Average recurring net per month over the next 12 months. */
  monthlyNetCents: number
  /** Whether any recurring income or cost lies ahead. */
  hasRecurring: boolean
  /** The projected balance, from today. */
  balance: BalancePoint[]
  /** When the last planned investment is affordable; null = not reachable or nothing planned. */
  date: string | null
}

export interface RoadmapInput {
  projects: readonly Project[]
  investments: readonly Investment[]
  incomeRules: readonly AmountRule[]
  costRules: readonly AmountRule[]
  today: string
}

export function buildRoadmap({ projects, investments, incomeRules, costRules, today }: RoadmapInput): Roadmap {
  const until = addToIsoDate(today, { months: ROADMAP_YEARS * 12 })
  const flows = projectedFlows(incomeRules, costRules, today, until)
  const groups = sortedProjects(projects).map((project) => ({
    project,
    planned: plannedInvestments(investments, project.id),
  }))
  const all = groups.flatMap((group) => group.planned)
  const inOrder = fundingDates(flows, all.map(neededCents), today)
  let offset = 0
  // When the investment before a project (in the whole order) is affordable; today for the first.
  let previous: string | null = today
  const forecasts = groups.map(({ project, planned }): ProjectForecast => {
    const startDate = previous
    const dates = inOrder.slice(offset, offset + planned.length)
    offset += planned.length
    for (const date of dates) previous = date
    const needed = planned.map(neededCents)
    const aloneDates = fundingDates(flows, needed, today)
    // One entry per planned investment in `dates`, `needed` and `aloneDates`.
    const items = dates.map((date, index) => ({ investment: planned[index]!, neededCents: needed[index]!, date }))
    return {
      project,
      investments: aloneDates.map((aloneDate, index) => ({ ...items[index]!, aloneDate })),
      totalCents: planned.reduce((sum, investment) => sum + investment.estimatedCostCents, 0),
      neededCents: needed.reduce((sum, cents) => sum + cents, 0),
      startDate,
      date: dates.at(-1) ?? null,
      aloneDate: aloneDates.at(-1) ?? null,
    }
  })
  return {
    projects: forecasts,
    monthlyNetCents: averageMonthlyNetCents(flows, today),
    hasRecurring: flows.length > 0,
    balance: balanceSteps(flows, today),
    date: inOrder.at(-1) ?? null,
  }
}

/** What a click on a chart item opens. */
export type RoadmapTarget =
  | { kind: 'project'; projectId: number }
  | { kind: 'investment'; projectId: number; investmentId: number }

/** A bar of the timeline, or a stretch of the savings curve: from when saving for it starts until it is affordable. */
export interface RoadmapSpan {
  target: RoadmapTarget
  title: string
  /** Index into the chart palette: the position of its project. */
  colorIndex: number
  start: string
  end: string
  /** What it still needs. */
  neededCents: number
}

/** A purchase on the savings curve: the day it becomes affordable. */
export interface RoadmapPurchase {
  target: RoadmapTarget
  title: string
  projectName: string
  priority: InvestmentPriority
  colorIndex: number
  date: string
  neededCents: number
}

/** What a roadmap chart draws. Items that are not reachable are left out. */
export interface RoadmapChartData {
  /** The savings curve: one stretch per project, coloured by it. */
  curve: RoadmapSpan[]
  purchases: RoadmapPurchase[]
  /** The timeline: one bar per project (overview) or per purchase (one project). */
  bars: RoadmapSpan[]
  balance: BalancePoint[]
  today: string
}

function purchaseOf(
  project: ProjectForecast,
  colorIndex: number,
  forecast: InvestmentForecast,
  date: string | null,
): RoadmapPurchase[] {
  if (date === null) return []
  const { investment } = forecast
  const target: RoadmapTarget = { kind: 'investment', projectId: project.project.id, investmentId: investment.id }
  const { title, priority } = investment
  const projectName = project.project.name
  return [{ target, title, projectName, priority, colorIndex, date, neededCents: forecast.neededCents }]
}

/** The chart of all projects, funded in their order. */
export function overviewChart(roadmap: Roadmap, today: string): RoadmapChartData {
  const curve = roadmap.projects.flatMap((forecast, colorIndex): RoadmapSpan[] => {
    const { project, startDate, date } = forecast
    if (startDate === null || date === null) return []
    const target: RoadmapTarget = { kind: 'project', projectId: project.id }
    return [{ target, title: project.name, colorIndex, start: startDate, end: date, neededCents: forecast.neededCents }]
  })
  const purchases = roadmap.projects.flatMap((forecast, colorIndex) =>
    forecast.investments.flatMap((investment) => purchaseOf(forecast, colorIndex, investment, investment.date)),
  )
  return { curve, purchases, bars: curve, balance: roadmap.balance, today }
}

/** The chart of one project on its own; null when the roadmap has no such project. */
export function projectChart(roadmap: Roadmap, projectId: number, today: string): RoadmapChartData | null {
  const colorIndex = roadmap.projects.findIndex((forecast) => forecast.project.id === projectId)
  const forecast = roadmap.projects[colorIndex]
  if (forecast === undefined) return null
  const { project, aloneDate } = forecast
  const curve: RoadmapSpan[] =
    aloneDate === null
      ? []
      : [
          {
            target: { kind: 'project', projectId },
            title: project.name,
            colorIndex,
            start: today,
            end: aloneDate,
            neededCents: forecast.neededCents,
          },
        ]
  const purchases = forecast.investments.flatMap((investment) =>
    purchaseOf(forecast, colorIndex, investment, investment.aloneDate),
  )
  // Each purchase is saved for after the one before it.
  const bars = purchases.map((purchase, index): RoadmapSpan => ({
    target: purchase.target,
    title: purchase.title,
    colorIndex,
    start: purchases[index - 1]?.date ?? today,
    end: purchase.date,
    neededCents: purchase.neededCents,
  }))
  return { curve, purchases, bars, balance: roadmap.balance, today }
}

/** What the roadmap card points out: nothing planned, no recurring payments, or dates beyond reach. */
export type RoadmapNotice = 'nothing-planned' | 'no-recurring' | 'not-reachable'

/** The notice for the dates of a roadmap's investments; null = every date is known. */
export function roadmapNotice(dates: readonly (string | null)[], hasRecurring: boolean): RoadmapNotice | null {
  if (dates.length === 0) return 'nothing-planned'
  if (dates.every((date) => date !== null)) return null
  return hasRecurring ? 'not-reachable' : 'no-recurring'
}
