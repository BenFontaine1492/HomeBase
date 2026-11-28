import { t } from '@/i18n'

/*
 * The category of a cost or an income entry: free text, like the name of an object
 * attribute. The forms suggest a default list (in the UI language) and the
 * categories used before. Categories that differ only in case or surrounding spaces
 * are the same. A category only groups entries (e.g. for the export to a tax
 * advisor); HomeBase gives no tax advice.
 */

/** What the category helpers read of an entry. */
export interface Categorised {
  /** null = no category. */
  category: string | null
}

/** The key of "no category" (no category key is empty, as keys are trimmed text). */
export const NO_CATEGORY = ''

/** A category key, NO_CATEGORY = the entries without one, or null = all. */
export type CategoryFilter = string | null

/** Categories are the same when they differ only in case or surrounding spaces. */
export function categoryKey(category: string): string {
  return category.trim().toLowerCase()
}

/** The key of an entry's category; NO_CATEGORY for none. */
export function categoryKeyOf(entry: Categorised): string {
  return entry.category === null ? NO_CATEGORY : categoryKey(entry.category)
}

export function matchesCategory(entry: Categorised, filter: CategoryFilter): boolean {
  return filter === null || categoryKeyOf(entry) === filter
}

/** The label of the entries without a category. */
export function noCategoryLabel(): string {
  return t('finances.noCategory')
}

/**
 * The categories a form offers: `defaults` (in their order), then the other ones in
 * `used`, alphabetically. Each one once, ignoring case.
 */
export function categorySuggestions(defaults: readonly string[], used: readonly (string | null)[]): string[] {
  const seen = new Set(defaults.map(categoryKey))
  const others: string[] = []
  for (const category of used) {
    if (category === null || seen.has(categoryKey(category))) continue
    seen.add(categoryKey(category))
    others.push(category)
  }
  // A fresh array; toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...defaults, ...others.sort((a, b) => a.localeCompare(b))]
}

/** The categories that occur in `entries` (first spelling wins), alphabetically. */
export function categoriesOf(entries: readonly Categorised[]): { key: string; label: string }[] {
  const byKey = new Map<string, string>()
  for (const { category } of entries) {
    if (category !== null && !byKey.has(categoryKey(category))) byKey.set(categoryKey(category), category)
  }
  // A fresh array; toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...byKey].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label))
}

/** The categories of `entries`, then "no category" (always last), each with its entries; empty ones left out. */
export function groupsByCategory<T extends Categorised>(
  entries: readonly T[],
): { key: string; label: string; entries: T[] }[] {
  return [...categoriesOf(entries), { key: NO_CATEGORY, label: noCategoryLabel() }]
    .map((group) => ({ ...group, entries: entries.filter((entry) => categoryKeyOf(entry) === group.key) }))
    .filter((group) => group.entries.length > 0)
}

export interface CategoryTotal {
  /** The category key, or NO_CATEGORY (always last). */
  key: string
  /** The category as first entered, or "No category". */
  label: string
  count: number
  amountCents: number
}

/** Totals per category, alphabetically, then the entries without a category. Empty groups are left out. */
export function totalsByCategory(entries: readonly (Categorised & { amountCents: number })[]): CategoryTotal[] {
  return groupsByCategory(entries).map(({ key, label, entries: members }) => ({
    key,
    label,
    count: members.length,
    amountCents: members.reduce((sum, entry) => sum + entry.amountCents, 0),
  }))
}
