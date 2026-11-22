import { addToIsoDate } from '@/utils/date'
import type { CategoryFilter, TimeRange, WidgetSettings } from './dashboard'
import { costTypeLabel, TAXES, taxesGroupLabel, taxGroupOf, type Cost, type TaxGroup } from './cost'
import { uncategorizedLabel, type HouseholdCategory } from './household-category'
import type { HouseholdObject } from './household-object'
import { INVESTMENT_PRIORITIES, type Investment, type InvestmentPriority } from './investment'
import { compareByUrgency, type MaintenanceSchedule } from './maintenance-schedule'
import type { MaintenanceTask } from './maintenance-task'
import type { TaxCategory } from './tax-category'

/*
 * The numbers behind the dashboard widgets. Pure functions: "today" is a parameter.
 */

/** One bar, point or slice of a chart. `key` identifies it, `label` is shown. */
export interface ChartPoint {
  key: string
  label: string
  value: number
}

/** The filter part of a widget's settings. */
export type WidgetFilter = Pick<WidgetSettings, 'categoryId' | 'objectId'>

type FilterObject = Pick<HouseholdObject, 'id' | 'categoryId'>

/**
 * The filter without parts that point to a deleted category or object (they count
 * as "all"); `stale` tells the widget to say so.
 */
export function resolveFilter(
  filter: WidgetFilter,
  categories: readonly Pick<HouseholdCategory, 'id'>[],
  objects: readonly Pick<HouseholdObject, 'id'>[],
): { filter: WidgetFilter; stale: boolean } {
  const { categoryId, objectId } = filter
  const categoryGone = typeof categoryId === 'number' && !categories.some((category) => category.id === categoryId)
  const objectGone = objectId !== null && !objects.some((object) => object.id === objectId)
  return {
    filter: { categoryId: categoryGone ? null : categoryId, objectId: objectGone ? null : objectId },
    stale: categoryGone || objectGone,
  }
}

function inCategory(object: FilterObject, categoryId: CategoryFilter): boolean {
  if (categoryId === null) return true
  return object.categoryId === (categoryId === 'none' ? null : categoryId)
}

/** Whether an object passes the filter. The object filter is narrower and wins over the category. */
export function matchesFilter(object: FilterObject, filter: WidgetFilter): boolean {
  return filter.objectId === null ? inCategory(object, filter.categoryId) : object.id === filter.objectId
}

/** Whether the filter selects anything, i.e. is not "all". */
export function isFiltered(filter: WidgetFilter): boolean {
  return filter.categoryId !== null || filter.objectId !== null
}

/** The first day of the time range ('YYYY-MM-DD'), or null for all time. */
export function timeRangeStart(range: TimeRange, today: string): string | null {
  const year = Number(today.slice(0, 4))
  switch (range) {
    case 'last-12-months':
      return addToIsoDate(`${today.slice(0, 7)}-01`, { months: -11 })
    case 'this-year':
      return `${year}-01-01`
    case 'last-5-years':
      return `${year - 4}-01-01`
    case 'all':
      return null
  }
}

/** Whether a time range is shown per month ('YYYY-MM' keys) rather than per year ('YYYY'). */
export function isMonthly(range: TimeRange): boolean {
  return range === 'last-12-months' || range === 'this-year'
}

/** The period keys from the range's start up to today, oldest first. */
function periodKeys(range: TimeRange, today: string, earliest: string | null): string[] {
  const start = timeRangeStart(range, today) ?? earliest ?? today
  const keys: string[] = []
  if (isMonthly(range)) {
    for (let month = `${start.slice(0, 7)}-01`; month <= today; month = addToIsoDate(month, { months: 1 })) {
      keys.push(month.slice(0, 7))
    }
    return keys
  }
  for (let year = Number(start.slice(0, 4)); year <= Number(today.slice(0, 4)); year += 1) keys.push(String(year))
  return keys
}

type CostSettings = WidgetFilter & Pick<WidgetSettings, 'timeRange' | 'costType'>

/** What the cost widgets read of a cost. */
export type CostPoint = Pick<Cost, 'paidDate' | 'amountCents' | 'costType' | 'objectId'>

/**
 * The costs within the time range (up to today) and of the cost type, each with its
 * object. With an object or category filter, only costs of the filtered objects.
 */
function costsIn<C extends CostPoint, O extends FilterObject>(
  costs: readonly C[],
  objects: readonly O[],
  settings: CostSettings,
  today: string,
): { cost: C; object: O | undefined }[] {
  const start = timeRangeStart(settings.timeRange, today)
  const filtered = isFiltered(settings)
  const shown = new Map(
    objects.filter((object) => matchesFilter(object, settings)).map((object) => [object.id, object]),
  )
  return costs.flatMap((cost) => {
    const object = cost.objectId === null ? undefined : shown.get(cost.objectId)
    const inRange = cost.paidDate <= today && (start === null || cost.paidDate >= start)
    const ofType = settings.costType === null || cost.costType === settings.costType
    return inRange && ofType && (object !== undefined || !filtered) ? [{ cost, object }] : []
  })
}

/**
 * Costs per month or year (cents), every period of the range included.
 * `formatMonth` turns a 'YYYY-MM' key into its label.
 */
export function costsOverTime(
  data: { costs: readonly CostPoint[]; objects: readonly FilterObject[] },
  settings: CostSettings,
  today: string,
  formatMonth: (key: string) => string,
): ChartPoint[] {
  const costs = costsIn(data.costs, data.objects, settings, today).map(({ cost }) => cost)
  const monthly = isMonthly(settings.timeRange)
  const earliest = costs.reduce<string | null>(
    (min, { paidDate }) => (min === null || paidDate < min ? paidDate : min),
    null,
  )
  return periodKeys(settings.timeRange, today, earliest).map((key) => ({
    key,
    label: monthly ? formatMonth(key) : key,
    value: costs.filter((cost) => cost.paidDate.startsWith(key)).reduce((sum, cost) => sum + cost.amountCents, 0),
  }))
}

/** Points per key, largest first, without zeros. */
function largestFirst(groups: ReadonlyMap<string, ChartPoint>): ChartPoint[] {
  // A fresh array; toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...groups.values()].filter((point) => point.value > 0).sort((a, b) => b.value - a.value)
}

/**
 * Costs in the time range split up (cents), largest first, without zeros: by cost
 * type when the widget shows everything, otherwise by object.
 */
export function costsByGroup(
  data: { costs: readonly CostPoint[]; objects: readonly Pick<HouseholdObject, 'id' | 'categoryId' | 'name'>[] },
  settings: CostSettings,
  today: string,
): ChartPoint[] {
  const byType = !isFiltered(settings)
  const groups = new Map<string, ChartPoint>()
  for (const { cost, object } of costsIn(data.costs, data.objects, settings, today)) {
    // With a filter, every cost has its object (see costsIn).
    const ofObject = byType || object === undefined ? null : object
    const key = ofObject === null ? `type-${cost.costType}` : `object-${ofObject.id}`
    const label = ofObject === null ? costTypeLabel(cost.costType) : ofObject.name
    const point = groups.get(key) ?? { key, label, value: 0 }
    point.value += cost.amountCents
    groups.set(key, point)
  }
  return largestFirst(groups)
}

/**
 * Costs with a tax category in the time range (up to today), per category in the
 * categories' order, then the taxes and fees (cost type 'tax'), without zeros. Costs
 * in neither group (also those of a deleted category) are left out.
 */
export function costsByTaxCategory(
  costs: readonly (CostPoint & Pick<Cost, 'taxCategoryId'>)[],
  categories: readonly Pick<TaxCategory, 'id' | 'name'>[],
  timeRange: TimeRange,
  today: string,
): ChartPoint[] {
  const start = timeRangeStart(timeRange, today)
  const inRange = costs.filter((cost) => cost.paidDate <= today && (start === null || cost.paidDate >= start))
  const groups: { key: string; label: string; group: TaxGroup }[] = [
    ...categories.map((category) => ({ key: `tax-category-${category.id}`, label: category.name, group: category.id })),
    { key: 'tax-group-taxes', label: taxesGroupLabel(), group: TAXES },
  ]
  return groups
    .map(({ key, label, group }) => ({
      key,
      label,
      value: inRange.filter((cost) => taxGroupOf(cost) === group).reduce((sum, cost) => sum + cost.amountCents, 0),
    }))
    .filter((point) => point.value > 0)
}

export function sumOf(points: readonly ChartPoint[]): number {
  return points.reduce((sum, point) => sum + point.value, 0)
}

/** A task with its object and schedule, for the "Upcoming maintenance" widget. */
export interface UpcomingTask<O extends FilterObject = HouseholdObject> {
  task: MaintenanceTask
  object: O
  schedule: MaintenanceSchedule
}

/** Overdue and due-soon tasks of filtered objects, most urgent first. */
export function upcomingMaintenance<O extends FilterObject>(
  tasks: readonly UpcomingTask<O>[],
  filter: WidgetFilter,
): UpcomingTask<O>[] {
  return (
    tasks
      .filter(
        ({ schedule, object }) => ['overdue', 'due-soon'].includes(schedule.status) && matchesFilter(object, filter),
      )
      // A fresh array; toSorted() needs lib ES2023 (tsconfig has ES2022).
      // oxlint-disable-next-line unicorn/no-array-sort
      .sort((a, b) => compareByUrgency(a.schedule, b.schedule))
  )
}

/** The last `count` objects added (that pass the filter), newest first. */
export function recentObjects<O extends FilterObject & Pick<HouseholdObject, 'createdAt'>>(
  objects: readonly O[],
  filter: WidgetFilter,
  count: number,
): O[] {
  return (
    objects
      .filter((object) => matchesFilter(object, filter))
      // A fresh array; toSorted() needs lib ES2023 (tsconfig has ES2022).
      // oxlint-disable-next-line unicorn/no-array-sort
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
      .slice(0, count)
  )
}

/** Number of objects per category (by name), then "No category assigned"; empty categories left out. */
export function objectsPerCategory(
  objects: readonly Pick<HouseholdObject, 'categoryId'>[],
  categories: readonly Pick<HouseholdCategory, 'id' | 'name'>[],
): ChartPoint[] {
  const count = (categoryId: number | null): number =>
    objects.filter((object) => object.categoryId === categoryId).length
  const points = [...categories]
    // A fresh array; toSorted() needs lib ES2023 (tsconfig has ES2022).
    // oxlint-disable-next-line unicorn/no-array-sort
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((category) => ({ key: `category-${category.id}`, label: category.name, value: count(category.id) }))
  points.push({ key: 'category-none', label: uncategorizedLabel(), value: count(null) })
  return points.filter((point) => point.value > 0)
}

/** Total purchase price of the objects, in cents (objects without a price count as 0). */
export function inventoryValueCents(objects: readonly Pick<HouseholdObject, 'purchasePriceCents'>[]): number {
  return objects.reduce((sum, object) => sum + (object.purchasePriceCents ?? 0), 0)
}

export interface PriorityTotal {
  priority: InvestmentPriority
  count: number
  amountCents: number
}

/** Count and estimated cost per priority, high to low (priorities without investments included). */
export function investmentsPerPriority(
  investments: readonly Pick<Investment, 'priority' | 'estimatedCostCents'>[],
): PriorityTotal[] {
  return INVESTMENT_PRIORITIES.map((priority) => {
    const matching = investments.filter((investment) => investment.priority === priority)
    return {
      priority,
      count: matching.length,
      amountCents: matching.reduce((sum, investment) => sum + investment.estimatedCostCents, 0),
    }
  })
}
