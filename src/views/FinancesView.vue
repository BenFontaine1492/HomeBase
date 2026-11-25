<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ListSection from '@/components/common/ListSection.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import CostFormDialog from '@/components/costs/CostFormDialog.vue'
import CostListItem from '@/components/costs/CostListItem.vue'
import CostReceiptsDialog from '@/components/costs/CostReceiptsDialog.vue'
import DuePaymentsSection from '@/components/costs/DuePaymentsSection.vue'
import RecurringCostPanel from '@/components/costs/RecurringCostPanel.vue'
import TaxExportDialog from '@/components/costs/TaxExportDialog.vue'
import CategoryTotalsCard from '@/components/finances/CategoryTotalsCard.vue'
import FinanceFilterBar from '@/components/finances/FinanceFilterBar.vue'
import IncomePanel from '@/components/income/IncomePanel.vue'
import RecurringIncomePanel from '@/components/income/RecurringIncomePanel.vue'
import { useAttachments } from '@/composables/useAttachments'
import { useCosts } from '@/composables/useCosts'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { useIncome } from '@/composables/useIncome'
import { useRecurringCosts } from '@/composables/useRecurringCosts'
import { useRecurringIncome } from '@/composables/useRecurringIncome'
import { t } from '@/i18n'
import { categoriesOf } from '@/types/category'
import { availableYears, filterCosts, type Cost, type CostInput, type FinanceFilter } from '@/types/cost'
import { costInputOfRule, type DuePayment } from '@/types/recurring-cost'
import { formatCents } from '@/utils/currency'
import { todayIsoDate } from '@/utils/date'
import { describeError } from '@/utils/error'

/**
 * The Finances page: tab "Costs" (due payments, filters, totals, list), tab "Income"
 * (the same for income), tab "Recurring" (the rules of both).
 */
const { costs, isLoading, error, ensureLoaded, refresh, findCost, titleOf, deleteCost } = useCosts()
const recurring = useRecurringCosts()
const { income, ensureLoaded: loadIncome } = useIncome()
const recurringIncome = useRecurringIncome()
const { findObject, ensureLoaded: loadObjects } = useHouseholdObjects()
const { attachmentsOf, ensureLoaded: loadAttachments } = useAttachments()

type Tab = 'costs' | 'income' | 'recurring'

const route = useRoute()
const tab = ref<Tab>(route.query.tab === 'recurring' || route.query.tab === 'income' ? route.query.tab : 'costs')
const incomePanel = ref<InstanceType<typeof IncomePanel> | null>(null)

const currentYear = Number(todayIsoDate().slice(0, 4))
const filter = ref<FinanceFilter>({ year: currentYear, category: null })
const categories = computed(() => categoriesOf(costs.value))

const years = computed<number[]>(() =>
  availableYears(
    costs.value.map((cost) => cost.paidDate),
    currentYear,
  ),
)
const incomeYears = computed<number[]>(() =>
  availableYears(
    income.value.map((entry) => entry.receivedDate),
    currentYear,
  ),
)
/** The years of the export: those with costs or income. */
const exportYears = computed<number[]>(() =>
  availableYears(
    [...costs.value.map((cost) => cost.paidDate), ...income.value.map((entry) => entry.receivedDate)],
    currentYear,
  ),
)
const shown = computed<Cost[]>(() => filterCosts(costs.value, filter.value))
const totalsCaption = computed<string>(() =>
  filter.value.year === null ? t('finances.filters.allYears') : t('costs.totals.year', { year: filter.value.year }),
)

const isExportOpen = ref(false)
const isFormOpen = ref(false)
const costToEdit = ref<Cost | null>(null)
const payment = ref<DuePayment | null>(null)
const prefill = ref<Partial<CostInput> | null>(null)
const isReceiptsOpen = ref(false)
const receiptsCost = ref<Cost | null>(null)
const isDeleteOpen = ref(false)
const costToDelete = ref<Cost | null>(null)
const skipping = ref<DuePayment | null>(null)
const skipError = ref<string | null>(null)

function receiptCount(cost: Cost): number {
  return attachmentsOf({ kind: 'cost', id: cost.id }).length
}

/** The page's main action: add a cost, or (on the Income tab) add income. */
function add(): void {
  if (tab.value === 'income') incomePanel.value?.openForm(null)
  else openForm(null)
}

function openForm(cost: Cost | null): void {
  costToEdit.value = cost
  payment.value = null
  prefill.value = null
  isFormOpen.value = true
}

/** "Paid…": the cost form, filled in from the rule; saving records the payment. */
function openPayment(due: DuePayment): void {
  costToEdit.value = null
  payment.value = due
  prefill.value = costInputOfRule(due.rule, due.dueDate)
  isFormOpen.value = true
}

async function skip(due: DuePayment): Promise<void> {
  skipping.value = due
  skipError.value = null
  try {
    await recurring.skipPayment(due)
  } catch (cause) {
    console.error(cause)
    skipError.value = describeError(cause)
  } finally {
    skipping.value = null
  }
}

function openReceipts(cost: Cost | null | undefined): void {
  if (!cost) return
  receiptsCost.value = cost
  isReceiptsOpen.value = true
}

function openDelete(cost: Cost): void {
  costToDelete.value = cost
  isDeleteOpen.value = true
}

async function deleteSelected(): Promise<void> {
  if (costToDelete.value) await deleteCost(costToDelete.value.id)
}

onMounted(() => {
  void Promise.all([
    ensureLoaded(),
    recurring.ensureLoaded(),
    loadIncome(),
    recurringIncome.ensureLoaded(),
    loadObjects(),
    loadAttachments(),
  ])
})
</script>

<template>
  <div>
    <PageHeader :title="t('finances.title')" :subtitle="t('finances.subtitle')">
      <template #actions>
        <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" v-bind="{ onClick: add }">
          {{ tab === 'income' ? t('income.add') : t('costs.add') }}
        </v-btn>
        <v-btn
          prepend-icon="mdi-folder-download-outline"
          :text="t('taxExport.open')"
          v-bind="{ onClick: () => (isExportOpen = true) }"
        />
      </template>
    </PageHeader>

    <v-alert v-if="error" type="error" class="mb-6" :title="t('costs.loadError')">
      {{ error }}
      <template #append>
        <v-btn variant="text" size="small" v-bind="{ onClick: refresh }">{{ t('common.retry') }}</v-btn>
      </template>
    </v-alert>
    <v-alert v-if="recurring.error.value" type="error" class="mb-6" :title="t('costs.recurring.loadError')">
      {{ recurring.error.value }}
    </v-alert>

    <v-tabs v-model="tab" class="mb-4">
      <v-tab value="costs">{{ t('finances.tabs.costs') }}</v-tab>
      <v-tab value="income">{{ t('finances.tabs.income') }}</v-tab>
      <v-tab value="recurring">{{ t('finances.tabs.recurring') }}</v-tab>
    </v-tabs>
    <!-- v-window clips its content (overflow: hidden): pt-2 keeps the floating labels of the filters visible. -->
    <v-window v-model="tab">
      <v-window-item value="costs" class="pt-2">
        <div class="hb-sections">
          <v-alert v-if="skipError" type="error" density="compact" closable @click:close="skipError = null">
            {{ skipError }}
          </v-alert>
          <DuePaymentsSection
            v-if="recurring.due.value.length > 0"
            :payments="recurring.due.value"
            :skipping="skipping"
            @paid="openPayment"
            @skip="skip"
          />
          <FinanceFilterBar v-model="filter" :years="years" :categories="categories" />
          <CategoryTotalsCard
            :entries="shown"
            :caption="totalsCaption"
            :count-label="t('costs.totals.count', { count: shown.length })"
          />

          <ListSection :title="t('costs.listTitle')" :count="shown.length">
            <CostListItem
              v-for="cost in shown"
              :key="cost.id"
              :cost="cost"
              :title="titleOf(cost)"
              :object-name="cost.objectId === null ? null : (findObject(cost.objectId)?.name ?? null)"
              :receipt-count="receiptCount(cost)"
              @receipts="openReceipts"
              @edit="openForm"
              @delete="openDelete"
            />
            <v-card v-if="shown.length === 0 && !isLoading">
              <EmptyState
                icon="mdi-cash-remove"
                :title="costs.length === 0 ? t('costs.emptyTitle') : t('costs.noMatchTitle')"
                :text="costs.length === 0 ? t('costs.emptyText') : t('costs.noMatchText')"
              />
            </v-card>
          </ListSection>
        </div>
      </v-window-item>
      <v-window-item value="income" class="pt-2">
        <IncomePanel ref="incomePanel" :years="incomeYears" :current-year="currentYear" />
      </v-window-item>
      <v-window-item value="recurring" class="pt-2">
        <div class="hb-sections">
          <RecurringCostPanel />
          <RecurringIncomePanel />
        </div>
      </v-window-item>
    </v-window>

    <TaxExportDialog v-model="isExportOpen" :year="filter.year ?? currentYear" :years="exportYears" />
    <CostFormDialog
      v-model="isFormOpen"
      :cost="costToEdit"
      :prefill="prefill"
      :payment="payment"
      @created="(id) => openReceipts(findCost(id))"
    />
    <CostReceiptsDialog
      v-model="isReceiptsOpen"
      :cost="receiptsCost"
      :title="receiptsCost ? titleOf(receiptsCost) : ''"
    />
    <ConfirmDialog v-model="isDeleteOpen" :title="t('costs.delete.title')" :action="deleteSelected">
      <template v-if="costToDelete">
        {{ t('costs.delete.text', { title: titleOf(costToDelete), amount: formatCents(costToDelete.amountCents) }) }}
      </template>
    </ConfirmDialog>
  </div>
</template>
