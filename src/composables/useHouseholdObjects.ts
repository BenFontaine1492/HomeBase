import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import {
  createObject,
  deleteObject as deleteObjectById,
  listObjects,
  updateObject as updateObjectById,
} from '@/services/household-object.service'
import { listAttributes } from '@/services/household-object-attribute.service'
import { describeError } from '@/utils/error'
import { reloadObjectChildren } from './reloadObjectChildren'
import {
  matchObjectNames,
  type HouseholdObject,
  type HouseholdObjectInput,
  type ObjectNameMatch,
} from '@/types/household-object'
import type { HouseholdObjectAttribute, HouseholdObjectAttributeInput } from '@/types/household-object-attribute'

// Module-level state: shared by every component that calls useHouseholdObjects().
const objects = ref<HouseholdObject[]>([])
/** Attributes of all objects (a household has few enough to keep them all loaded). */
const attributes = ref<HouseholdObjectAttribute[]>([])
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

function findObject(id: number): HouseholdObject | undefined {
  return objects.value.find((object) => object.id === id)
}

/** An existing object whose name matches the one being entered. */
export interface HouseholdObjectNameMatch {
  object: HouseholdObject
  match: ObjectNameMatch
}

/**
 * Existing objects (in any category) whose name matches `name`, exact matches first.
 * When editing, pass the edited object: it never matches itself, and nothing is
 * reported while its name is unchanged.
 */
function findNameMatches(name: string, editedObject?: HouseholdObject | null): HouseholdObjectNameMatch[] {
  if (editedObject && matchObjectNames(name, editedObject.name) === 'exact') return []
  const matches: HouseholdObjectNameMatch[] = []
  for (const object of objects.value) {
    const match = object.id === editedObject?.id ? null : matchObjectNames(name, object.name)
    if (match) matches.push({ object, match })
  }
  return [...matches.filter(({ match }) => match === 'exact'), ...matches.filter(({ match }) => match === 'near')]
}

/** The attributes of one object, in display order. */
function attributesOf(objectId: number): HouseholdObjectAttribute[] {
  return attributes.value.filter((attribute) => attribute.objectId === objectId)
}

/**
 * Every attribute name in use, once (ignoring case), sorted. Suggested in the
 * form so the same attribute gets the same name on every object.
 */
const attributeNames = computed<string[]>(() => {
  const byKey = new Map<string, string>()
  for (const { name } of attributes.value) {
    if (!byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), name)
  }
  // Sorts a fresh copy; toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
})

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    const [loadedObjects, loadedAttributes] = await Promise.all([listObjects(), listAttributes()])
    objects.value = loadedObjects
    attributes.value = loadedAttributes
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

/** Creates an object with its attributes and returns the new id. */
async function addObject(
  input: HouseholdObjectInput,
  attributeInputs: readonly HouseholdObjectAttributeInput[],
): Promise<number> {
  const id = await createObject(input, attributeInputs)
  await refresh()
  return id
}

/** Updates an object and replaces its attributes. */
async function updateObject(
  id: number,
  input: HouseholdObjectInput,
  attributeInputs: readonly HouseholdObjectAttributeInput[],
): Promise<void> {
  await updateObjectById(id, input, attributeInputs)
  await refresh()
}

/** Deletes an object; its maintenance and documents go with it, so they are reloaded too. */
async function deleteObject(id: number): Promise<void> {
  await deleteObjectById(id)
  await Promise.all([refresh(), reloadObjectChildren()])
}

export interface UseHouseholdObjects {
  objects: Readonly<Ref<readonly HouseholdObject[]>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  uncategorizedCount: ComputedRef<number>
  countFor: (categoryId: number | null) => number
  objectsInCategory: (categoryId: number | null) => HouseholdObject[]
  findObject: (id: number) => HouseholdObject | undefined
  findNameMatches: (name: string, editedObject?: HouseholdObject | null) => HouseholdObjectNameMatch[]
  attributesOf: (objectId: number) => HouseholdObjectAttribute[]
  attributeNames: ComputedRef<string[]>
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  addObject: (input: HouseholdObjectInput, attributes: readonly HouseholdObjectAttributeInput[]) => Promise<number>
  updateObject: (
    id: number,
    input: HouseholdObjectInput,
    attributes: readonly HouseholdObjectAttributeInput[],
  ) => Promise<void>
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
    findObject,
    findNameMatches,
    attributesOf,
    attributeNames,
    refresh,
    ensureLoaded,
    addObject,
    updateObject,
    deleteObject,
  }
}
