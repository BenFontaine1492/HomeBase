import { readonly, ref, type Ref } from 'vue'
import { t } from '@/i18n'
import * as costService from '@/services/cost.service'
import type { Cost, CostInput } from '@/types/cost'
import { describeError } from '@/utils/error'
import { useAttachments } from './useAttachments'
import { useMaintenance } from './useMaintenance'

// Module-level state: shared by every component that calls useCosts().
/** Newest first. */
const costs = ref<Cost[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

function findCost(id: number): Cost | undefined {
  return costs.value.find((cost) => cost.id === id)
}

/** What a cost was for: its description, or (for the cost of a maintenance record) the task done. */
function titleOf(cost: Cost): string {
  if (cost.description !== null) return cost.description
  const { records, findTask } = useMaintenance()
  const record = records.value.find((candidate) => candidate.id === cost.maintenanceRecordId)
  return findTask(record?.taskId ?? null)?.name ?? t('costs.maintenanceWork')
}

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    costs.value = await costService.listCosts()
    hasLoaded = true
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  } finally {
    isLoading.value = false
  }
}

/** Loads the costs, once, and the maintenance they refer to (for the titles). */
async function ensureLoaded(): Promise<void> {
  await Promise.all([!hasLoaded && !isLoading.value ? refresh() : undefined, useMaintenance().ensureLoaded()])
}

// Writes reload afterwards and rethrow errors for the dialogs.

/** Adds a cost and returns its id (to attach receipts). */
async function addCost(input: CostInput): Promise<number> {
  const id = await costService.createCost(input)
  await refresh()
  return id
}

/** Updates a cost; of a maintenance record's cost only the details (the record owns date, amount and payee). */
async function updateCost(id: number, input: CostInput): Promise<void> {
  const cost = findCost(id)
  if (cost !== undefined && cost.maintenanceRecordId !== null) {
    await costService.updateCostDetails(id, input)
  } else {
    await costService.updateCost(id, input)
  }
  await refresh()
}

/** Deletes a cost; its receipts go with it, so the documents are reloaded too. */
async function deleteCost(id: number): Promise<void> {
  await costService.deleteCost(id)
  await Promise.all([refresh(), useAttachments().refresh()])
}

export interface UseCosts {
  costs: Readonly<Ref<readonly Cost[]>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  findCost: (id: number) => Cost | undefined
  titleOf: (cost: Cost) => string
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  addCost: (input: CostInput) => Promise<number>
  updateCost: (id: number, input: CostInput) => Promise<void>
  deleteCost: (id: number) => Promise<void>
}

export function useCosts(): UseCosts {
  return {
    costs: readonly(costs) as Readonly<Ref<readonly Cost[]>>,
    isLoading: readonly(isLoading),
    error: readonly(error),
    findCost,
    titleOf,
    refresh,
    ensureLoaded,
    addCost,
    updateCost,
    deleteCost,
  }
}
