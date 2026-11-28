import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import {
  createInvestment,
  deleteInvestment as deleteInvestmentById,
  listInvestments,
  markPlanned as markInvestmentPlanned,
  markPurchased as markInvestmentPurchased,
  reorderInvestments,
  updateInvestment as updateInvestmentById,
} from '@/services/investment.service'
import { describeError } from '@/utils/error'
import {
  movedOrder,
  plannedInvestments,
  purchasedInvestments,
  type Investment,
  type InvestmentInput,
} from '@/types/investment'

// Module-level state: shared by every component that calls useInvestments().
const investments = ref<Investment[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

/** Planned investments in priority order. */
const planned = computed<Investment[]>(() => plannedInvestments(investments.value))
/** Purchased investments, newest purchase first. */
const purchased = computed<Investment[]>(() => purchasedInvestments(investments.value))

/** Total estimated cost of the planned investments. */
const totalEstimatedCostCents = computed<number>(() =>
  planned.value.reduce((sum, investment) => sum + investment.estimatedCostCents, 0),
)

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    investments.value = await listInvestments()
    hasLoaded = true
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  } finally {
    isLoading.value = false
  }
}

/** Loads investments once; later calls reuse the already loaded state. */
async function ensureLoaded(): Promise<void> {
  if (!hasLoaded && !isLoading.value) await refresh()
}

// Write operations reload the list afterwards so the UI always reflects SQLite.
// They rethrow errors so the calling dialog can show them next to the form.

async function addInvestment(input: InvestmentInput): Promise<void> {
  await createInvestment(input)
  await refresh()
}

async function updateInvestment(id: number, input: InvestmentInput): Promise<void> {
  await updateInvestmentById(id, input)
  await refresh()
}

async function markPurchased(investment: Investment, purchasedDate: string): Promise<void> {
  await markInvestmentPurchased(investment, purchasedDate)
  await refresh()
}

async function markPlanned(investment: Investment): Promise<void> {
  await markInvestmentPlanned(investment)
  await refresh()
}

/** Moves a planned investment to position `toIndex` of its project's priority list. */
async function moveInvestment(id: number, toIndex: number): Promise<void> {
  const projectId = investments.value.find((investment) => investment.id === id)?.projectId
  if (projectId === undefined) return
  const ids = plannedInvestments(investments.value, projectId).map((investment) => investment.id)
  const order = movedOrder(ids, id, toIndex)
  if (order.every((value, index) => value === ids[index])) return
  try {
    await reorderInvestments(order)
  } finally {
    await refresh()
  }
}

async function deleteInvestment(id: number): Promise<void> {
  await deleteInvestmentById(id)
  await refresh()
}

export interface UseInvestments {
  investments: Readonly<Ref<readonly Investment[]>>
  planned: ComputedRef<Investment[]>
  purchased: ComputedRef<Investment[]>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  totalEstimatedCostCents: ComputedRef<number>
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  addInvestment: (input: InvestmentInput) => Promise<void>
  updateInvestment: (id: number, input: InvestmentInput) => Promise<void>
  markPurchased: (investment: Investment, purchasedDate: string) => Promise<void>
  markPlanned: (investment: Investment) => Promise<void>
  moveInvestment: (id: number, toIndex: number) => Promise<void>
  deleteInvestment: (id: number) => Promise<void>
}

export function useInvestments(): UseInvestments {
  return {
    investments: readonly(investments) as Readonly<Ref<readonly Investment[]>>,
    planned,
    purchased,
    isLoading: readonly(isLoading),
    error: readonly(error),
    totalEstimatedCostCents,
    refresh,
    ensureLoaded,
    addInvestment,
    updateInvestment,
    markPurchased,
    markPlanned,
    moveInvestment,
    deleteInvestment,
  }
}
