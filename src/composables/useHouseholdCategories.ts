import { readonly, ref, type Ref } from 'vue'
import {
  createCategory,
  deleteCategory as deleteCategoryById,
  listCategories,
  updateCategory as updateCategoryById,
  type DeleteCategoryOptions,
} from '@/services/household-category.service'
import { describeError } from '@/services/database/database-error'
import { useHouseholdObjects } from './useHouseholdObjects'
import type { HouseholdCategory, HouseholdCategoryInput } from '@/types/household-category'

// Module-level state: shared by every component that calls useHouseholdCategories().
// Object counts per category come from useHouseholdObjects(), so object writes
// don't need to reload the categories.
const categories = ref<HouseholdCategory[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    categories.value = await listCategories()
    hasLoaded = true
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  } finally {
    isLoading.value = false
  }
}

/** Loads categories once; later calls reuse the already loaded state. */
async function ensureLoaded(): Promise<void> {
  if (!hasLoaded && !isLoading.value) await refresh()
}

function findCategory(id: number | null): HouseholdCategory | undefined {
  return id === null ? undefined : categories.value.find((category) => category.id === id)
}

// Write operations reload afterwards so the UI always reflects SQLite.
// They rethrow errors so the calling dialog can show them.

async function addCategory(input: HouseholdCategoryInput): Promise<number> {
  const id = await createCategory(input)
  await refresh()
  return id
}

async function updateCategory(id: number, input: HouseholdCategoryInput): Promise<void> {
  await updateCategoryById(id, input)
  await refresh()
}

/** Deleting a category changes or removes its objects, so both lists are reloaded. */
async function deleteCategory(id: number, options: DeleteCategoryOptions): Promise<void> {
  try {
    await deleteCategoryById(id, options)
  } finally {
    await Promise.all([refresh(), useHouseholdObjects().refresh()])
  }
}

export interface UseHouseholdCategories {
  categories: Readonly<Ref<readonly HouseholdCategory[]>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  findCategory: (id: number | null) => HouseholdCategory | undefined
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  addCategory: (input: HouseholdCategoryInput) => Promise<number>
  updateCategory: (id: number, input: HouseholdCategoryInput) => Promise<void>
  deleteCategory: (id: number, options: DeleteCategoryOptions) => Promise<void>
}

export function useHouseholdCategories(): UseHouseholdCategories {
  return {
    categories: readonly(categories) as Readonly<Ref<readonly HouseholdCategory[]>>,
    isLoading: readonly(isLoading),
    error: readonly(error),
    findCategory,
    refresh,
    ensureLoaded,
    addCategory,
    updateCategory,
    deleteCategory,
  }
}
