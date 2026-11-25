import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import * as recurringIncomeService from '@/services/recurring-income.service'
import type { IncomeInput } from '@/types/income'
import type { DueIncome, RecurringIncome, RecurringIncomeInput } from '@/types/recurring-income'
import { dueOccurrences } from '@/types/recurring-schedule'
import { todayIsoDate } from '@/utils/date'
import { describeError } from '@/utils/error'
import { useIncome } from './useIncome'

// Module-level state: shared by every component that calls useRecurringIncome().
const rules = ref<RecurringIncome[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
/** The load (with the autopay run) of this session, once started. */
let loading: Promise<void> | null = null

/** The due payments of the rules that are not autopay, as of today. */
const due = computed<DueIncome[]>(() => dueOccurrences(rules.value, todayIsoDate()))

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    rules.value = await recurringIncomeService.listRecurringIncome()
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  } finally {
    isLoading.value = false
  }
}

/** Records the rows of autopay payments that are due (catching up missed ones), then reloads. */
async function runAutopay(): Promise<void> {
  try {
    const created = await recurringIncomeService.createDueAutopayIncome(rules.value, todayIsoDate())
    if (created > 0) await Promise.all([refresh(), useIncome().refresh()])
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

async function addRule(input: RecurringIncomeInput): Promise<void> {
  await recurringIncomeService.createRecurringIncome(input)
  await refresh()
  // A new autopay rule may already be due (e.g. it started last month).
  await runAutopay()
}

async function updateRule(id: number, input: RecurringIncomeInput): Promise<void> {
  await recurringIncomeService.updateRecurringIncome(id, input)
  await refresh()
  await runAutopay()
}

async function deleteRule(id: number): Promise<void> {
  await recurringIncomeService.deleteRecurringIncome(id)
  await Promise.all([refresh(), useIncome().refresh()])
}

/** "Received": records the due payment as the income `input`. */
async function confirmReceipt(payment: DueIncome, input: IncomeInput): Promise<void> {
  await recurringIncomeService.confirmReceipt(payment, input)
  await Promise.all([refresh(), useIncome().refresh()])
}

/** "Skip": the payment is not recorded; the next one is due. */
async function skipReceipt(payment: DueIncome): Promise<void> {
  await recurringIncomeService.skipReceipt(payment)
  await refresh()
}

export interface UseRecurringIncome {
  rules: Readonly<Ref<readonly RecurringIncome[]>>
  due: ComputedRef<DueIncome[]>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  addRule: (input: RecurringIncomeInput) => Promise<void>
  updateRule: (id: number, input: RecurringIncomeInput) => Promise<void>
  deleteRule: (id: number) => Promise<void>
  confirmReceipt: (payment: DueIncome, input: IncomeInput) => Promise<void>
  skipReceipt: (payment: DueIncome) => Promise<void>
}

export function useRecurringIncome(): UseRecurringIncome {
  return {
    rules: readonly(rules) as Readonly<Ref<readonly RecurringIncome[]>>,
    due,
    isLoading: readonly(isLoading),
    error: readonly(error),
    refresh,
    ensureLoaded,
    addRule,
    updateRule,
    deleteRule,
    confirmReceipt,
    skipReceipt,
  }
}
