import { readonly, ref, type Ref } from 'vue'
import * as incomeService from '@/services/income.service'
import type { Income, IncomeInput } from '@/types/income'
import { describeError } from '@/utils/error'
import { useAttachments } from './useAttachments'

// Module-level state: shared by every component that calls useIncome().
/** Newest first. */
const income = ref<Income[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

function findIncome(id: number): Income | undefined {
  return income.value.find((entry) => entry.id === id)
}

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    income.value = await incomeService.listIncome()
    hasLoaded = true
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  } finally {
    isLoading.value = false
  }
}

/** Loads the income, once. */
async function ensureLoaded(): Promise<void> {
  if (!hasLoaded && !isLoading.value) await refresh()
}

// Writes reload afterwards and rethrow errors for the dialogs.

/** Adds an income entry and returns its id (to attach documents). */
async function addIncome(input: IncomeInput): Promise<number> {
  const id = await incomeService.createIncome(input)
  await refresh()
  return id
}

async function updateIncome(id: number, input: IncomeInput): Promise<void> {
  await incomeService.updateIncome(id, input)
  await refresh()
}

/** Deletes an income entry; its documents go with it, so the documents are reloaded too. */
async function deleteIncome(id: number): Promise<void> {
  await incomeService.deleteIncome(id)
  await Promise.all([refresh(), useAttachments().refresh()])
}

export interface UseIncome {
  income: Readonly<Ref<readonly Income[]>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  findIncome: (id: number) => Income | undefined
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  addIncome: (input: IncomeInput) => Promise<number>
  updateIncome: (id: number, input: IncomeInput) => Promise<void>
  deleteIncome: (id: number) => Promise<void>
}

export function useIncome(): UseIncome {
  return {
    income: readonly(income) as Readonly<Ref<readonly Income[]>>,
    isLoading: readonly(isLoading),
    error: readonly(error),
    findIncome,
    refresh,
    ensureLoaded,
    addIncome,
    updateIncome,
    deleteIncome,
  }
}
