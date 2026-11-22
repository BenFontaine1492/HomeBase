import { describe, expect, it } from 'vitest'
import {
  costsByGroup,
  costsByTaxCategory,
  costsOverTime,
  inventoryValueCents,
  investmentsPerPriority,
  isFiltered,
  isMonthly,
  matchesFilter,
  objectsPerCategory,
  recentObjects,
  resolveFilter,
  sumOf,
  timeRangeStart,
  upcomingMaintenance,
  type UpcomingTask,
  type WidgetFilter,
} from '@/types/dashboard-statistics'
import type { TimeRange } from '@/types/dashboard'
import type { Cost, CostType } from '@/types/cost'
import type { MaintenanceSchedule, MaintenanceStatus } from '@/types/maintenance-schedule'
import type { MaintenanceTask } from '@/types/maintenance-task'

const TODAY = '2026-11-18'
const ALL: WidgetFilter = { categoryId: null, objectId: null }

const categories = [
  { id: 1, name: 'Heating' },
  { id: 2, name: 'Appliances' },
]
const objects = [
  { id: 10, name: 'Heat pump', categoryId: 1, createdAt: '2026-01-05T10:00:00Z', purchasePriceCents: 1_500_000 },
  { id: 11, name: 'Boiler', categoryId: 1, createdAt: '2026-03-01T10:00:00Z', purchasePriceCents: null },
  { id: 12, name: 'Fridge', categoryId: 2, createdAt: '2026-03-01T10:00:00Z', purchasePriceCents: 80_000 },
  { id: 13, name: 'Ladder', categoryId: null, createdAt: '2025-12-24T10:00:00Z', purchasePriceCents: 5_000 },
]

type TestCost = Pick<Cost, 'paidDate' | 'amountCents' | 'costType' | 'objectId' | 'taxCategoryId'>

/** A maintenance cost; `fields` sets the tax category or another type. */
function cost(
  objectId: number | null,
  paidDate: string,
  amountCents: number,
  fields: Partial<TestCost> = {},
): TestCost {
  return { objectId, paidDate, amountCents, costType: 'maintenance', taxCategoryId: null, ...fields }
}

const costs = [
  cost(10, '2026-10-02', 25_000),
  cost(11, '2026-10-20', 10_000),
  cost(12, '2025-06-01', 5_000),
  cost(13, '2026-02-10', 0),
  cost(13, '2026-02-11', 2_000),
  cost(10, '2019-05-05', 99_000), // before "last 5 years"
  cost(10, '2026-12-01', 1_000), // in the future
  cost(99, '2026-10-01', 1_000), // object not loaded
  cost(null, '2026-03-15', 3_000, { costType: 'energy' }), // no object
]

describe('filters', () => {
  it('matches by category, "no category" and object; the object wins', () => {
    const [heatPump, , , ladder] = objects
    expect(matchesFilter(heatPump!, ALL)).toBe(true)
    expect(matchesFilter(heatPump!, { categoryId: 1, objectId: null })).toBe(true)
    expect(matchesFilter(heatPump!, { categoryId: 2, objectId: null })).toBe(false)
    expect(matchesFilter(ladder!, { categoryId: 'none', objectId: null })).toBe(true)
    expect(matchesFilter(heatPump!, { categoryId: 'none', objectId: null })).toBe(false)
    expect(matchesFilter(heatPump!, { categoryId: 2, objectId: 10 })).toBe(true)
    expect(matchesFilter(ladder!, { categoryId: null, objectId: 10 })).toBe(false)
  })

  it('knows whether anything is filtered', () => {
    expect(isFiltered(ALL)).toBe(false)
    expect(isFiltered({ categoryId: 'none', objectId: null })).toBe(true)
    expect(isFiltered({ categoryId: null, objectId: 3 })).toBe(true)
  })

  it('drops filter parts that point to deleted rows', () => {
    expect(resolveFilter({ categoryId: 1, objectId: 10 }, categories, objects)).toEqual({
      filter: { categoryId: 1, objectId: 10 },
      stale: false,
    })
    expect(resolveFilter({ categoryId: 'none', objectId: null }, categories, objects).stale).toBe(false)
    expect(resolveFilter({ categoryId: 9, objectId: 10 }, categories, objects)).toEqual({
      filter: { categoryId: null, objectId: 10 },
      stale: true,
    })
    expect(resolveFilter({ categoryId: 1, objectId: 99 }, categories, objects)).toEqual({
      filter: { categoryId: 1, objectId: null },
      stale: true,
    })
  })
})

describe('time ranges', () => {
  it.each([
    ['last-12-months', '2025-12-01'],
    ['this-year', '2026-01-01'],
    ['last-5-years', '2022-01-01'],
    ['all', null],
  ] as const)('%s starts at %s', (range, start) => {
    expect(timeRangeStart(range, TODAY)).toBe(start)
  })

  it('shows short ranges per month', () => {
    expect(isMonthly('last-12-months')).toBe(true)
    expect(isMonthly('this-year')).toBe(true)
    expect(isMonthly('last-5-years')).toBe(false)
    expect(isMonthly('all')).toBe(false)
  })
})

describe('costsOverTime', () => {
  const data = { costs, objects }
  const sums = (timeRange: TimeRange, filter: WidgetFilter = ALL, costType: CostType | null = null) =>
    costsOverTime(data, { ...filter, timeRange, costType }, TODAY, (key) => `month ${key}`)

  it('sums per month, every month of the range included', () => {
    const points = sums('last-12-months')
    expect(points).toHaveLength(12)
    expect(points[0]).toEqual({ key: '2025-12', label: 'month 2025-12', value: 0 })
    expect(points.find((point) => point.key === '2026-02')?.value).toBe(2_000)
    expect(points.at(-2)).toEqual({ key: '2026-10', label: 'month 2026-10', value: 36_000 })
    expect(points.at(-1)?.key).toBe('2026-11')
    expect(sums('this-year')).toHaveLength(11)
  })

  it('sums per year', () => {
    expect(sums('last-5-years').map(({ label, value }) => [label, value])).toEqual([
      ['2022', 0],
      ['2023', 0],
      ['2024', 0],
      ['2025', 5_000],
      ['2026', 41_000],
    ])
    expect(sums('all')[0]).toEqual({ key: '2019', label: '2019', value: 99_000 })
    expect(sums('all')).toHaveLength(8)
  })

  it('applies the object filter and the cost type, and shows the current year without any costs', () => {
    expect(sumOf(sums('all', { categoryId: 1, objectId: null }))).toBe(134_000)
    expect(sumOf(sums('all', { categoryId: null, objectId: 12 }))).toBe(5_000)
    expect(sumOf(sums('all', ALL, 'energy'))).toBe(3_000)
    expect(costsOverTime({ costs: [], objects }, { ...ALL, timeRange: 'all', costType: null }, TODAY, String)).toEqual([
      { key: '2026', label: '2026', value: 0 },
    ])
  })
})

describe('costsByGroup', () => {
  const data = { costs, objects }

  it('splits by cost type when nothing is filtered, largest first, without zeros', () => {
    expect(costsByGroup(data, { ...ALL, timeRange: 'last-5-years', costType: null }, TODAY)).toEqual([
      { key: 'type-maintenance', label: 'Maintenance', value: 43_000 },
      { key: 'type-energy', label: 'Energy', value: 3_000 },
    ])
  })

  it('splits by object when filtered', () => {
    const settings = { categoryId: 1, objectId: null, timeRange: 'this-year', costType: null } as const
    expect(costsByGroup(data, settings, TODAY)).toEqual([
      { key: 'object-10', label: 'Heat pump', value: 25_000 },
      { key: 'object-11', label: 'Boiler', value: 10_000 },
    ])
  })
})

describe('costsByTaxCategory', () => {
  it('sums the costs with a tax category in the range, in category order, then the taxes and fees', () => {
    const taxCategories = [
      { id: 1, name: 'Handwerkerleistungen' },
      { id: 2, name: 'Spenden' },
      { id: 3, name: 'Versicherungen' },
    ]
    const taxed = [
      cost(null, '2026-02-01', 500, { taxCategoryId: 2 }),
      cost(null, '2026-03-01', 700, { taxCategoryId: 1 }),
      cost(null, '2026-04-01', 300, { taxCategoryId: 1 }),
      cost(null, '2025-12-31', 900, { taxCategoryId: 1 }),
      cost(null, '2026-12-01', 900, { taxCategoryId: 1 }),
      cost(null, '2026-05-01', 900),
      cost(null, '2026-05-15', 120, { costType: 'tax' }),
    ]
    expect(costsByTaxCategory(taxed, taxCategories, 'this-year', TODAY)).toEqual([
      { key: 'tax-category-1', label: 'Handwerkerleistungen', value: 1_000 },
      { key: 'tax-category-2', label: 'Spenden', value: 500 },
      { key: 'tax-group-taxes', label: 'Taxes and fees', value: 120 },
    ])
    expect(sumOf(costsByTaxCategory(taxed, taxCategories, 'all', TODAY))).toBe(2_520)
  })
})

describe('upcomingMaintenance', () => {
  function upcoming(id: number, objectIndex: number, status: MaintenanceStatus, daysUntilDue: number | null) {
    const schedule: MaintenanceSchedule = { status, lastDone: null, dueDate: null, daysUntilDue }
    return { task: { id } as MaintenanceTask, object: objects[objectIndex]!, schedule }
  }

  it('keeps overdue and due-soon tasks of filtered objects, most urgent first', () => {
    const tasks: UpcomingTask<(typeof objects)[number]>[] = [
      upcoming(1, 0, 'due-soon', 10),
      upcoming(2, 1, 'overdue', -3),
      upcoming(3, 2, 'ok', 100),
      upcoming(4, 2, 'due-soon', 2),
      upcoming(5, 3, 'unknown', null),
      upcoming(6, 0, 'paused', null),
    ]
    expect(upcomingMaintenance(tasks, ALL).map(({ task }) => task.id)).toEqual([2, 4, 1])
    expect(upcomingMaintenance(tasks, { categoryId: 1, objectId: null }).map(({ task }) => task.id)).toEqual([2, 1])
  })
})

describe('recentObjects', () => {
  it('returns the newest objects first (ties: higher id first)', () => {
    expect(recentObjects(objects, ALL, 3).map((object) => object.id)).toEqual([12, 11, 10])
    expect(recentObjects(objects, { categoryId: 'none', objectId: null }, 3).map((object) => object.id)).toEqual([13])
  })
})

describe('inventory', () => {
  it('counts objects per category by name, then uncategorised, without empty ones', () => {
    expect(objectsPerCategory(objects, [...categories, { id: 3, name: 'Garden' }])).toEqual([
      { key: 'category-2', label: 'Appliances', value: 1 },
      { key: 'category-1', label: 'Heating', value: 2 },
      { key: 'category-none', label: 'No category assigned', value: 1 },
    ])
    expect(objectsPerCategory([], categories)).toEqual([])
  })

  it('sums the purchase prices', () => {
    expect(inventoryValueCents(objects)).toBe(1_585_000)
  })
})

describe('investmentsPerPriority', () => {
  it('counts and sums per priority, high to low', () => {
    const investments = [
      { priority: 'low', estimatedCostCents: 100 },
      { priority: 'high', estimatedCostCents: 500 },
      { priority: 'low', estimatedCostCents: 50 },
    ] as const
    expect(investmentsPerPriority(investments)).toEqual([
      { priority: 'high', count: 1, amountCents: 500 },
      { priority: 'medium', count: 0, amountCents: 0 },
      { priority: 'low', count: 2, amountCents: 150 },
    ])
  })
})
