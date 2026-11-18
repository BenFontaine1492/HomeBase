import { addToIsoDate } from '@/utils/date'
import type { CategoryFilter, TimeRange, WidgetSettings } from './dashboard'
import { UNCATEGORIZED_LABEL, type HouseholdCategory } from './household-category'
import type { HouseholdObject } from './household-object'
import { INVESTMENT_PRIORITIES, type Investment, type InvestmentPriority } from './investment'
import { compareByUrgency, type MaintenanceSchedule } from './maintenance-schedule'
import type { MaintenanceRecord } from './maintenance-record'
import type { MaintenanceTask } from './maintenance-task'

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

type CostSettings = WidgetFilter & Pick<WidgetSettings, 'timeRange'>

/** The records of filtered objects within the time range (up to today), each with its object. */
function recordsIn<O extends FilterObject>(
  records: readonly MaintenanceRecord[],
  objects: readonly O[],
  settings: CostSettings,
  today: string,
): { record: MaintenanceRecord; object: O }[] {
  const start = timeRangeStart(settings.timeRange, today)
  const shown = new Map(
    objects.filter((object) => matchesFilter(object, settings)).map((object) => [object.id, object]),
  )
  return records.flatMap((record) => {
    const object = shown.get(record.objectId)
    const inRange = record.date <= today && (start === null || record.date >= start)
    return object && inRange ? [{ record, object }] : []
  })
}

/**
 * Maintenance costs per month or year (cents), every period of the range included.
 * `formatMonth` turns a 'YYYY-MM' key into its label.
 */
export function maintenanceCostsOverTime(
  data: { records: readonly MaintenanceRecord[]; objects: readonly FilterObject[] },
  settings: CostSettings,
  today: string,
  formatMonth: (key: string) => string,
): ChartPoint[] {
  const records = recordsIn(data.records, data.objects, settings, today).map(({ record }) => record)
  const monthly = isMonthly(settings.timeRange)
  const earliest = records.reduce<string | null>((min, { date }) => (min === null || date < min ? date : min), null)
  return periodKeys(settings.timeRange, today, earliest).map((key) => ({
    key,
    label: monthly ? formatMonth(key) : key,
    value: records.filter((record) => record.date.startsWith(key)).reduce((sum, r) => sum + (r.costCents ?? 0), 0),
  }))
}

/**
 * Maintenance costs in the time range split up (cents), largest first, without zeros:
 * by category when the widget shows everything, otherwise by object.
 */
export function maintenanceCostsByGroup(
  data: {
    records: readonly MaintenanceRecord[]
    objects: readonly Pick<HouseholdObject, 'id' | 'categoryId' | 'name'>[]
    categories: readonly Pick<HouseholdCategory, 'id' | 'name'>[]
  },
  settings: CostSettings,
  today: string,
): ChartPoint[] {
  const byCategory = !isFiltered(settings)
  const categoryNames = new Map(data.categories.map((category) => [category.id, category.name]))
  const groups = new Map<string, ChartPoint>()
  for (const { record, object } of recordsIn(data.records, data.objects, settings, today)) {
    const key = byCategory ? `category-${object.categoryId ?? 'none'}` : `object-${object.id}`
    // Ids start at 1, so 0 finds no name: objects without a category.
    const label = byCategory ? (categoryNames.get(object.categoryId ?? 0) ?? UNCATEGORIZED_LABEL) : object.name
    const point = groups.get(key) ?? { key, label, value: 0 }
    point.value += record.costCents ?? 0
    groups.set(key, point)
  }
  // A fresh array; toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...groups.values()].filter((point) => point.value > 0).sort((a, b) => b.value - a.value)
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
  points.push({ key: 'category-none', label: UNCATEGORIZED_LABEL, value: count(null) })
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
