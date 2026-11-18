import type { CategoryFilter } from './dashboard'
import type { HouseholdCategory } from './household-category'
import type { HouseholdObject } from './household-object'
import type { HouseholdObjectAttribute } from './household-object-attribute'
import type { Investment, InvestmentPriority, InvestmentStatus } from './investment'
import type { MaintenanceStatus } from './maintenance-schedule'

/*
 * Global search (Search page): objects and investments that contain every word of
 * the query, narrowed by filters. Pure functions over the already loaded lists.
 */

export const SEARCH_KINDS = ['all', 'objects', 'investments'] as const
export type SearchKind = (typeof SEARCH_KINDS)[number]

/** Maintenance filter: a status, 'none' = objects without maintenance tasks, null = any. */
export type MaintenanceFilter = MaintenanceStatus | 'none' | null

export interface SearchFilters {
  kind: SearchKind
  /** Objects only. */
  categoryId: CategoryFilter
  /** Objects only. */
  maintenance: MaintenanceFilter
  /** Investments only. */
  priority: InvestmentPriority | null
  /** Investments only. */
  investmentStatus: InvestmentStatus | null
}

export const NO_SEARCH_FILTERS: Readonly<SearchFilters> = {
  kind: 'all',
  categoryId: null,
  maintenance: null,
  priority: null,
  investmentStatus: null,
}

/** The words of a query, lower case; an empty query matches everything. */
export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

function containsAll(texts: readonly (string | null)[], terms: readonly string[]): boolean {
  const haystack = texts.filter(Boolean).join('\n').toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

export interface ObjectSearchData {
  objects: readonly HouseholdObject[]
  categories: readonly HouseholdCategory[]
  attributes: readonly HouseholdObjectAttribute[]
  /** The object's overall maintenance status; null = no tasks. */
  maintenanceOf: (object: HouseholdObject) => MaintenanceStatus | null
}

export interface ObjectSearchHit {
  object: HouseholdObject
  /** Attributes that contain a word of the query, e.g. Refrigerant = R290 (shown under the name). */
  matchedAttributes: HouseholdObjectAttribute[]
}

function matchesObjectFilters(object: HouseholdObject, filters: SearchFilters, data: ObjectSearchData): boolean {
  const { categoryId, maintenance } = filters
  if (categoryId !== null && (object.categoryId ?? 'none') !== categoryId) return false
  if (maintenance === null) return true
  return (data.maintenanceOf(object) ?? 'none') === maintenance
}

function attributeText(attribute: HouseholdObjectAttribute): string {
  return [attribute.name, attribute.value, attribute.unit].filter(Boolean).join(' ')
}

/** Objects with every word of `query` in a text field, their category or an attribute, in list order. */
export function searchObjects(data: ObjectSearchData, query: string, filters: SearchFilters): ObjectSearchHit[] {
  if (filters.kind === 'investments') return []
  const terms = searchTerms(query)
  const categoryNames = new Map(data.categories.map((category) => [category.id, category.name]))
  return data.objects.flatMap((object) => {
    if (!matchesObjectFilters(object, filters, data)) return []
    const attributes = data.attributes.filter((attribute) => attribute.objectId === object.id)
    const { name, manufacturer, model, serialNumber, location, notes } = object
    const texts = [
      name,
      manufacturer,
      model,
      serialNumber,
      location,
      notes,
      categoryNames.get(object.categoryId ?? 0) ?? null,
    ]
    if (!containsAll([...texts, ...attributes.map(attributeText)], terms)) return []
    const matchedAttributes = attributes.filter((attribute) =>
      terms.some((term) => attributeText(attribute).toLowerCase().includes(term)),
    )
    return [{ object, matchedAttributes }]
  })
}

/** Investments with every word of `query` in their title or description, in list order. */
export function searchInvestments(
  investments: readonly Investment[],
  query: string,
  filters: SearchFilters,
): Investment[] {
  if (filters.kind === 'objects') return []
  const terms = searchTerms(query)
  return investments.filter(
    (investment) =>
      (filters.priority === null || investment.priority === filters.priority) &&
      (filters.investmentStatus === null || investment.status === filters.investmentStatus) &&
      containsAll([investment.title, investment.description], terms),
  )
}

/** Whether anything is searched or filtered (otherwise the page shows a hint instead of everything). */
export function isSearching(query: string, filters: SearchFilters): boolean {
  const { categoryId, maintenance, priority, investmentStatus } = filters
  return searchTerms(query).length > 0 || [categoryId, maintenance, priority, investmentStatus].some((v) => v !== null)
}
