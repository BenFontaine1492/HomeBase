import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import {
  createObject,
  deleteObject as deleteObjectById,
  listObjects,
  updateObject as updateObjectById,
} from '@/services/household-object.service'
import { describeError } from '@/services/database/database-error'
import type { HouseholdObject, HouseholdObjectInput } from '@/types/household-object'

// Module-level state: shared by every component that calls useHouseholdObjects().
const objects = ref<HouseholdObject[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

/** Number of objects per category id. The key `null` counts uncategorized objects. */
const countByCategory = computed<ReadonlyMap<number | null, number>>(() => {
  const counts = new Map<number | null, number>()
  for (const object of objects.value) {
    counts.set(object.categoryId, (counts.get(object.categoryId) ?? 0) + 1)
  }
  return counts
})

const uncategorizedCount = computed<number>(() => countByCategory.value.get(null) ?? 0)

function countFor(categoryId: number | null): number {
  return countByCategory.value.get(categoryId) ?? 0
}

function objectsInCategory(categoryId: number | null): HouseholdObject[] {
  return objects.value.filter((object) => object.categoryId === categoryId)
}

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    objects.value = await listObjects()
    hasLoaded = true
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  } finally {
    isLoading.value = false
  }
}

/** Loads objects once; later calls reuse the already loaded state. */
async function ensureLoaded(): Promise<void> {
  if (!hasLoaded && !isLoading.value) await refresh()
}

// Write operations reload the list afterwards so the UI always reflects SQLite.
// They rethrow errors so the calling dialog can show them next to the form.

async function addObject(input: HouseholdObjectInput): Promise<void> {
  await createObject(input)
  await refresh()
}

async function updateObject(id: number, input: HouseholdObjectInput): Promise<void> {
  await updateObjectById(id, input)
  await refresh()
}

async function deleteObject(id: number): Promise<void> {
  await deleteObjectById(id)
  await refresh()
}

export interface UseHouseholdObjects {
  objects: Readonly<Ref<readonly HouseholdObject[]>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  uncategorizedCount: ComputedRef<number>
  countFor: (categoryId: number | null) => number
  objectsInCategory: (categoryId: number | null) => HouseholdObject[]
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  addObject: (input: HouseholdObjectInput) => Promise<void>
  updateObject: (id: number, input: HouseholdObjectInput) => Promise<void>
  deleteObject: (id: number) => Promise<void>
}

export function useHouseholdObjects(): UseHouseholdObjects {
  return {
    objects: readonly(objects) as Readonly<Ref<readonly HouseholdObject[]>>,
    isLoading: readonly(isLoading),
    error: readonly(error),
    uncategorizedCount,
    countFor,
    objectsInCategory,
    refresh,
    ensureLoaded,
    addObject,
    updateObject,
    deleteObject,
  }
}
