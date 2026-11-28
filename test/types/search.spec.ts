import { describe, expect, it } from 'vitest'
import type { HouseholdCategory } from '@/types/household-category'
import type { HouseholdObject } from '@/types/household-object'
import type { HouseholdObjectAttribute } from '@/types/household-object-attribute'
import type { Investment } from '@/types/investment'
import {
  NO_SEARCH_FILTERS,
  isSearching,
  searchInvestments,
  searchObjects,
  searchTerms,
  type ObjectSearchData,
  type SearchFilters,
} from '@/types/search'

function object(id: number, name: string, changes: Partial<HouseholdObject> = {}): HouseholdObject {
  return {
    id,
    name,
    categoryId: null,
    manufacturer: null,
    model: null,
    serialNumber: null,
    purchaseDate: null,
    purchasePriceCents: null,
    installationDate: null,
    location: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...changes,
  }
}

function attribute(id: number, objectId: number, name: string, value: string | null): HouseholdObjectAttribute {
  return { id, objectId, name, valueType: 'text', value, unit: null, sortOrder: id }
}

function investment(id: number, title: string, changes: Partial<Investment> = {}): Investment {
  return {
    id,
    projectId: 1,
    title,
    description: null,
    estimatedCostCents: 0,
    priority: 'medium',
    sortOrder: id,
    status: 'planned',
    purchasedDate: null,
    targetDate: null,
    budgetCents: null,
    savedCents: null,
    createdAt: '',
    updatedAt: '',
    ...changes,
  }
}

const heating: HouseholdCategory = {
  id: 7,
  name: 'Heating',
  icon: 'mdi-radiator',
  description: null,
  createdAt: '',
  updatedAt: '',
}

const data: ObjectSearchData = {
  objects: [
    object(1, 'Heat pump', { categoryId: 7, manufacturer: 'Vaillant', location: 'Garden' }),
    object(2, 'Fridge', { notes: 'Bought used' }),
    object(3, 'Boiler', { categoryId: 7 }),
  ],
  categories: [heating],
  attributes: [attribute(1, 1, 'Refrigerant', 'R290'), attribute(2, 1, 'Power', '12'), attribute(3, 2, 'Colour', null)],
  maintenanceOf: (item) => (item.id === 1 ? 'overdue' : item.id === 3 ? 'ok' : null),
}

function filters(changes: Partial<SearchFilters> = {}): SearchFilters {
  return { ...NO_SEARCH_FILTERS, ...changes }
}

function ids(hits: { object: HouseholdObject }[]): number[] {
  return hits.map((hit) => hit.object.id)
}

describe('searchTerms', () => {
  it('splits the query into lower-case words', () => {
    expect(searchTerms('  Heat  PUMP ')).toEqual(['heat', 'pump'])
    expect(searchTerms('')).toEqual([])
  })
})

describe('searchObjects', () => {
  it('finds objects that contain every word, in fields, the category or attributes', () => {
    expect(ids(searchObjects(data, 'vaillant garden', filters()))).toEqual([1])
    expect(ids(searchObjects(data, 'heating', filters()))).toEqual([1, 3])
    expect(ids(searchObjects(data, 'used', filters()))).toEqual([2])
    expect(ids(searchObjects(data, 'heat r290', filters()))).toEqual([1])
    expect(ids(searchObjects(data, 'heat r32', filters()))).toEqual([])
  })

  it('lists the attributes that matched', () => {
    const [hit] = searchObjects(data, 'r290', filters())
    expect(hit?.matchedAttributes.map(({ name }) => name)).toEqual(['Refrigerant'])
    expect(searchObjects(data, 'pump', filters())[0]?.matchedAttributes).toEqual([])
  })

  it('returns everything for an empty query', () => {
    expect(ids(searchObjects(data, '', filters()))).toEqual([1, 2, 3])
  })

  it('filters by category and maintenance status', () => {
    expect(ids(searchObjects(data, '', filters({ categoryId: 7 })))).toEqual([1, 3])
    expect(ids(searchObjects(data, '', filters({ categoryId: 'none' })))).toEqual([2])
    expect(ids(searchObjects(data, '', filters({ maintenance: 'overdue' })))).toEqual([1])
    expect(ids(searchObjects(data, '', filters({ maintenance: 'none' })))).toEqual([2])
    expect(ids(searchObjects(data, '', filters({ categoryId: 7, maintenance: 'ok' })))).toEqual([3])
  })

  it('finds no objects when only investments are searched', () => {
    expect(searchObjects(data, '', filters({ kind: 'investments' }))).toEqual([])
  })
})

describe('searchInvestments', () => {
  const investments = [
    investment(1, 'Heat pump', { description: 'Replace the old boiler', priority: 'high' }),
    investment(2, 'Roof', { status: 'purchased', purchasedDate: '2026-01-01' }),
  ]

  it('finds investments by title and description', () => {
    expect(searchInvestments(investments, 'boiler', filters()).map(({ id }) => id)).toEqual([1])
    expect(searchInvestments(investments, '', filters()).map(({ id }) => id)).toEqual([1, 2])
  })

  it('filters by priority and status', () => {
    expect(searchInvestments(investments, '', filters({ priority: 'high' })).map(({ id }) => id)).toEqual([1])
    expect(searchInvestments(investments, '', filters({ investmentStatus: 'purchased' })).map(({ id }) => id)).toEqual([
      2,
    ])
  })

  it('finds no investments when only objects are searched', () => {
    expect(searchInvestments(investments, '', filters({ kind: 'objects' }))).toEqual([])
  })
})

describe('isSearching', () => {
  it('is true for a query or any filter', () => {
    expect(isSearching(' ', filters())).toBe(false)
    expect(isSearching('', filters({ kind: 'objects' }))).toBe(false)
    expect(isSearching('x', filters())).toBe(true)
    expect(isSearching('', filters({ priority: 'low' }))).toBe(true)
  })
})
