import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import {
  createInvestment,
  deleteInvestment as deleteInvestmentById,
  listInvestments,
  updateInvestment as updateInvestmentById,
} from '@/services/investment.service'
import { describeError } from '@/utils/error'
import type { Investment, InvestmentInput } from '@/types/investment'

// Module-level state: shared by every component that calls useInvestments().
const investments = ref<Investment[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

const totalEstimatedCostCents = computed<number>(() =>
  investments.value.reduce((sum, investment) => sum + investment.estimatedCostCents, 0),
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

async function deleteInvestment(id: number): Promise<void> {
  await deleteInvestmentById(id)
  await refresh()
}

export interface UseInvestments {
  investments: Readonly<Ref<readonly Investment[]>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  totalEstimatedCostCents: ComputedRef<number>
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  addInvestment: (input: InvestmentInput) => Promise<void>
  updateInvestment: (id: number, input: InvestmentInput) => Promise<void>
  deleteInvestment: (id: number) => Promise<void>
}

export function useInvestments(): UseInvestments {
  return {
    investments: readonly(investments) as Readonly<Ref<readonly Investment[]>>,
    isLoading: readonly(isLoading),
    error: readonly(error),
    totalEstimatedCostCents,
    refresh,
    ensureLoaded,
    addInvestment,
    updateInvestment,
    deleteInvestment,
  }
}
