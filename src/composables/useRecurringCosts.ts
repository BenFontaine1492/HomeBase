import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import * as recurringCostService from '@/services/recurring-cost.service'
import type { CostInput } from '@/types/cost'
import type { DuePayment, RecurringCost, RecurringCostInput } from '@/types/recurring-cost'
import { dueOccurrences } from '@/types/recurring-schedule'
import { todayIsoDate } from '@/utils/date'
import { describeError } from '@/utils/error'
import { useCosts } from './useCosts'

// Module-level state: shared by every component that calls useRecurringCosts().
const rules = ref<RecurringCost[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
/** The load (with the autopay run) of this session, once started. */
let loading: Promise<void> | null = null

/** The due payments of the rules that are not autopay, as of today. */
const due = computed<DuePayment[]>(() => dueOccurrences(rules.value, todayIsoDate()))

function findRule(id: number | null): RecurringCost | undefined {
  return id === null ? undefined : rules.value.find((rule) => rule.id === id)
}

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    rules.value = await recurringCostService.listRecurringCosts()
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  } finally {
    isLoading.value = false
  }
}

/** Creates the rows of autopay payments that are due (catching up missed ones), then reloads. */
async function runAutopay(): Promise<void> {
  try {
    const created = await recurringCostService.createDueAutopayCosts(rules.value, todayIsoDate())
    if (created > 0) await Promise.all([refresh(), useCosts().refresh()])
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  }
}

/** Loads the rules once per session and records the autopay payments that are due (called at app start). */
function ensureLoaded(): Promise<void> {
  loading ??= refresh().then(runAutopay)
  return loading
}

// Writes reload afterwards and rethrow errors for the dialogs.

async function addRule(input: RecurringCostInput): Promise<void> {
  await recurringCostService.createRecurringCost(input)
  await refresh()
  // A new autopay rule may already be due (e.g. it started last month).
  await runAutopay()
}

async function updateRule(id: number, input: RecurringCostInput): Promise<void> {
  await recurringCostService.updateRecurringCost(id, input)
  await refresh()
  await runAutopay()
}

async function deleteRule(id: number): Promise<void> {
  await recurringCostService.deleteRecurringCost(id)
  await Promise.all([refresh(), useCosts().refresh()])
}

/** "Paid": records the due payment as the cost `input`. */
async function confirmPayment(payment: DuePayment, input: CostInput): Promise<void> {
  await recurringCostService.confirmPayment(payment, input)
  await Promise.all([refresh(), useCosts().refresh()])
}

/** "Skip": the payment is not recorded; the next one is due. */
async function skipPayment(payment: DuePayment): Promise<void> {
  await recurringCostService.skipPayment(payment)
  await refresh()
}

export interface UseRecurringCosts {
  rules: Readonly<Ref<readonly RecurringCost[]>>
  due: ComputedRef<DuePayment[]>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  findRule: (id: number | null) => RecurringCost | undefined
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  addRule: (input: RecurringCostInput) => Promise<void>
  updateRule: (id: number, input: RecurringCostInput) => Promise<void>
  deleteRule: (id: number) => Promise<void>
  confirmPayment: (payment: DuePayment, input: CostInput) => Promise<void>
  skipPayment: (payment: DuePayment) => Promise<void>
}

export function useRecurringCosts(): UseRecurringCosts {
  return {
    rules: readonly(rules) as Readonly<Ref<readonly RecurringCost[]>>,
    due,
    isLoading: readonly(isLoading),
    error: readonly(error),
    findRule,
    refresh,
    ensureLoaded,
    addRule,
    updateRule,
    deleteRule,
    confirmPayment,
    skipPayment,
  }
}
