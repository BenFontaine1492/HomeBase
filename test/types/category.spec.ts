import { describe, expect, it } from 'vitest'
import {
  categoriesOf,
  categoryKey,
  categoryKeyOf,
  categorySuggestions,
  groupsByCategory,
  matchesCategory,
  NO_CATEGORY,
  noCategoryLabel,
  totalsByCategory,
} from '@/types/category'

const entries = [
  { id: 1, category: 'Photovoltaik', amountCents: 50_00 },
  { id: 2, category: 'Miete', amountCents: 100_00 },
  { id: 3, category: ' photovoltaik ', amountCents: 25_00 },
  { id: 4, category: null, amountCents: 10_00 },
]

describe('categories', () => {
  it('treats categories that differ only in case or spaces as one', () => {
    expect(categoryKey(' Photovoltaik ')).toBe('photovoltaik')
    expect(categoryKeyOf({ category: null })).toBe(NO_CATEGORY)
    expect(categoriesOf(entries)).toEqual([
      { key: 'miete', label: 'Miete' },
      { key: 'photovoltaik', label: 'Photovoltaik' },
    ])
  })

  it('suggests the defaults, then the other categories used, each once', () => {
    const used = ['photovoltaik', null, 'Zinsen Tagesgeld', 'Garage', 'garage ']
    expect(categorySuggestions(['Gehalt', 'Photovoltaik'], used)).toEqual([
      'Gehalt',
      'Photovoltaik',
      'Garage',
      'Zinsen Tagesgeld',
    ])
    expect(categorySuggestions(['Gehalt'], [])).toEqual(['Gehalt'])
  })

  it('filters by category key, NO_CATEGORY or all', () => {
    const ids = (filter: string | null) => entries.filter((e) => matchesCategory(e, filter)).map((e) => e.id)
    expect(ids(null)).toEqual([1, 2, 3, 4])
    expect(ids('photovoltaik')).toEqual([1, 3])
    expect(ids(NO_CATEGORY)).toEqual([4])
  })

  it('groups and sums per category, the entries without one last', () => {
    expect(groupsByCategory(entries).map((group) => [group.label, group.entries.map((e) => e.id)])).toEqual([
      ['Miete', [2]],
      ['Photovoltaik', [1, 3]],
      ['No category', [4]],
    ])
    expect(totalsByCategory(entries)).toEqual([
      { key: 'miete', label: 'Miete', count: 1, amountCents: 100_00 },
      { key: 'photovoltaik', label: 'Photovoltaik', count: 2, amountCents: 75_00 },
      { key: NO_CATEGORY, label: 'No category', count: 1, amountCents: 10_00 },
    ])
    expect(totalsByCategory(entries.slice(0, 1))).toHaveLength(1)
    expect(noCategoryLabel()).toBe('No category')
  })
})
