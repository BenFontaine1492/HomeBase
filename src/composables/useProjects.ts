import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import {
  createProject,
  deleteProject as deleteProjectById,
  listProjects,
  reorderProjects,
  updateProject as updateProjectById,
} from '@/services/project.service'
import { movedOrder } from '@/types/investment'
import { sortedProjects, type Project, type ProjectInput } from '@/types/project'
import { describeError } from '@/utils/error'
import { useInvestments } from './useInvestments'

// Module-level state: shared by every component that calls useProjects().
const projects = ref<Project[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

/** The projects in their order (= funding order of the roadmap). */
const ordered = computed<Project[]>(() => sortedProjects(projects.value))

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    projects.value = await listProjects()
    hasLoaded = true
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  } finally {
    isLoading.value = false
  }
}

/** Loads the projects once; later calls reuse the already loaded state. */
async function ensureLoaded(): Promise<void> {
  if (!hasLoaded && !isLoading.value) await refresh()
}

// Write operations reload the list afterwards so the UI always reflects SQLite.
// They rethrow errors so the calling dialog can show them next to the form.

/** Adds a project at the end of the list and returns its id. */
async function addProject(input: ProjectInput): Promise<number> {
  const id = await createProject(input)
  await refresh()
  return id
}

async function updateProject(id: number, input: ProjectInput): Promise<void> {
  await updateProjectById(id, input)
  await refresh()
}

/** Moves a project to position `toIndex` of the list. */
async function moveProject(id: number, toIndex: number): Promise<void> {
  const ids = ordered.value.map((project) => project.id)
  const order = movedOrder(ids, id, toIndex)
  if (order.every((value, index) => value === ids[index])) return
  try {
    await reorderProjects(order)
  } finally {
    await refresh()
  }
}

/** Deletes a project; its investments go with it, so they are reloaded too. */
async function deleteProject(id: number): Promise<void> {
  await deleteProjectById(id)
  await Promise.all([refresh(), useInvestments().refresh()])
}

export interface UseProjects {
  projects: ComputedRef<Project[]>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  addProject: (input: ProjectInput) => Promise<number>
  updateProject: (id: number, input: ProjectInput) => Promise<void>
  moveProject: (id: number, toIndex: number) => Promise<void>
  deleteProject: (id: number) => Promise<void>
}

export function useProjects(): UseProjects {
  return {
    projects: ordered,
    isLoading: readonly(isLoading),
    error: readonly(error),
    refresh,
    ensureLoaded,
    addProject,
    updateProject,
    moveProject,
    deleteProject,
  }
}
