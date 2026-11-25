<script setup lang="ts">
import { computed, ref } from 'vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ListSection from '@/components/common/ListSection.vue'
import CategoryTotalsCard from '@/components/finances/CategoryTotalsCard.vue'
import FinanceFilterBar from '@/components/finances/FinanceFilterBar.vue'
import DueIncomeSection from './DueIncomeSection.vue'
import IncomeDocumentsDialog from './IncomeDocumentsDialog.vue'
import IncomeFormDialog from './IncomeFormDialog.vue'
import IncomeListItem from './IncomeListItem.vue'
import { useAttachments } from '@/composables/useAttachments'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { useIncome } from '@/composables/useIncome'
import { useRecurringIncome } from '@/composables/useRecurringIncome'
import { t } from '@/i18n'
import { categoriesOf } from '@/types/category'
import type { FinanceFilter } from '@/types/cost'
import { filterIncome, type Income, type IncomeInput } from '@/types/income'
import { incomeInputOfRule, type DueIncome } from '@/types/recurring-income'
import { formatCents } from '@/utils/currency'
import { describeError } from '@/utils/error'

/** The "Income" tab of the Finances page: due payments, filters, totals, list. */
const props = defineProps<{
  years: readonly number[]
  /** Preselected year of the filter. */
  currentYear: number
}>()

const { income, isLoading, error, refresh, findIncome, deleteIncome } = useIncome()
const recurring = useRecurringIncome()
const { findObject } = useHouseholdObjects()
const { attachmentsOf } = useAttachments()

const filter = ref<FinanceFilter>({ year: props.currentYear, category: null })

const categories = computed(() => categoriesOf(income.value))
const shown = computed<Income[]>(() => filterIncome(income.value, filter.value))
const totalsCaption = computed<string>(() =>
  filter.value.year === null ? t('finances.filters.allYears') : t('income.totals.year', { year: filter.value.year }),
)

const isFormOpen = ref(false)
const incomeToEdit = ref<Income | null>(null)
const payment = ref<DueIncome | null>(null)
const prefill = ref<Partial<IncomeInput> | null>(null)
const isDocumentsOpen = ref(false)
const documentsIncome = ref<Income | null>(null)
const isDeleteOpen = ref(false)
const incomeToDelete = ref<Income | null>(null)
const skipping = ref<DueIncome | null>(null)
const skipError = ref<string | null>(null)

function documentCount(entry: Income): number {
  return attachmentsOf({ kind: 'income', id: entry.id }).length
}

function openForm(entry: Income | null): void {
  incomeToEdit.value = entry
  payment.value = null
  prefill.value = null
  isFormOpen.value = true
}

/** "Received…": the income form, filled in from the rule; saving records the payment. */
function openReceipt(due: DueIncome): void {
  incomeToEdit.value = null
  payment.value = due
  prefill.value = incomeInputOfRule(due.rule, due.dueDate)
  isFormOpen.value = true
}

async function skip(due: DueIncome): Promise<void> {
  skipping.value = due
  skipError.value = null
  try {
    await recurring.skipReceipt(due)
  } catch (cause) {
    console.error(cause)
    skipError.value = describeError(cause)
  } finally {
    skipping.value = null
  }
}

function openDocuments(entry: Income | null | undefined): void {
  if (!entry) return
  documentsIncome.value = entry
  isDocumentsOpen.value = true
}

function openDelete(entry: Income): void {
  incomeToDelete.value = entry
  isDeleteOpen.value = true
}

async function deleteSelected(): Promise<void> {
  if (incomeToDelete.value) await deleteIncome(incomeToDelete.value.id)
}

defineExpose({ openForm })
</script>

<template>
  <div class="hb-sections">
    <v-alert v-if="error" type="error" :title="t('income.loadError')">
      {{ error }}
      <template #append>
        <v-btn variant="text" size="small" v-bind="{ onClick: refresh }">{{ t('common.retry') }}</v-btn>
      </template>
    </v-alert>
    <v-alert v-if="recurring.error.value" type="error" :title="t('income.recurring.loadError')">
      {{ recurring.error.value }}
    </v-alert>
    <v-alert v-if="skipError" type="error" density="compact" closable @click:close="skipError = null">
      {{ skipError }}
    </v-alert>
    <DueIncomeSection
      v-if="recurring.due.value.length > 0"
      :payments="recurring.due.value"
      :skipping="skipping"
      @received="openReceipt"
      @skip="skip"
    />
    <FinanceFilterBar v-model="filter" :years="years" :categories="categories" />
    <CategoryTotalsCard
      :entries="shown"
      :caption="totalsCaption"
      :count-label="t('income.totals.count', { count: shown.length })"
    />

    <ListSection :title="t('income.listTitle')" :count="shown.length">
      <IncomeListItem
        v-for="entry in shown"
        :key="entry.id"
        :income="entry"
        :object-name="entry.householdObjectId === null ? null : (findObject(entry.householdObjectId)?.name ?? null)"
        :document-count="documentCount(entry)"
        @documents="openDocuments"
        @edit="openForm"
        @delete="openDelete"
      />
      <v-card v-if="shown.length === 0 && !isLoading">
        <EmptyState
          icon="mdi-cash-plus"
          :title="income.length === 0 ? t('income.emptyTitle') : t('income.noMatchTitle')"
          :text="income.length === 0 ? t('income.emptyText') : t('income.noMatchText')"
        />
      </v-card>
    </ListSection>

    <IncomeFormDialog
      v-model="isFormOpen"
      :income="incomeToEdit"
      :prefill="prefill"
      :payment="payment"
      @created="(id) => openDocuments(findIncome(id))"
    />
    <IncomeDocumentsDialog v-model="isDocumentsOpen" :income="documentsIncome" />
    <ConfirmDialog v-model="isDeleteOpen" :title="t('income.delete.title')" :action="deleteSelected">
      <template v-if="incomeToDelete">
        {{
          t('income.delete.text', {
            title: incomeToDelete.description,
            amount: formatCents(incomeToDelete.amountCents),
          })
        }}
      </template>
    </ConfirmDialog>
  </div>
</template>
