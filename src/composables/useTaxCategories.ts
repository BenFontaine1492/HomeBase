import { readonly, ref, type Ref } from 'vue'
import * as taxCategoryService from '@/services/tax-category.service'
import type { TaxCategory, TaxCategoryInput } from '@/types/tax-category'
import { describeError } from '@/utils/error'
import { useCosts } from './useCosts'
import { useRecurringCosts } from './useRecurringCosts'

// Module-level state: shared by every component that calls useTaxCategories().
const categories = ref<TaxCategory[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

function findCategory(id: number | null): TaxCategory | undefined {
  return id === null ? undefined : categories.value.find((category) => category.id === id)
}

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    categories.value = await taxCategoryService.listTaxCategories()
    hasLoaded = true
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  } finally {
    isLoading.value = false
  }
}

async function ensureLoaded(): Promise<void> {
  if (!hasLoaded && !isLoading.value) await refresh()
}

// Writes reload afterwards and rethrow errors for the dialogs.

async function addCategory(input: TaxCategoryInput): Promise<void> {
  await taxCategoryService.createTaxCategory(input)
  await refresh()
}

async function updateCategory(id: number, input: TaxCategoryInput): Promise<void> {
  await taxCategoryService.updateTaxCategory(id, input)
  await refresh()
}

/** Deletes a category; its costs and rules lose their category, so they are reloaded too. */
async function deleteCategory(id: number): Promise<void> {
  await taxCategoryService.deleteTaxCategory(id)
  await Promise.all([refresh(), useCosts().refresh(), useRecurringCosts().refresh()])
}

async function addDefaults(): Promise<void> {
  await taxCategoryService.addDefaultTaxCategories()
  await refresh()
}

export interface UseTaxCategories {
  categories: Readonly<Ref<readonly TaxCategory[]>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  findCategory: (id: number | null) => TaxCategory | undefined
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  addCategory: (input: TaxCategoryInput) => Promise<void>
  updateCategory: (id: number, input: TaxCategoryInput) => Promise<void>
  deleteCategory: (id: number) => Promise<void>
  addDefaults: () => Promise<void>
}

export function useTaxCategories(): UseTaxCategories {
  return {
    categories: readonly(categories) as Readonly<Ref<readonly TaxCategory[]>>,
    isLoading: readonly(isLoading),
    error: readonly(error),
    findCategory,
    refresh,
    ensureLoaded,
    addCategory,
    updateCategory,
    deleteCategory,
    addDefaults,
  }
}
