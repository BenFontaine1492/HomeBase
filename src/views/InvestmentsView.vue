<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import CostFormDialog from '@/components/costs/CostFormDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import HouseholdObjectFormDialog from '@/components/inventory/HouseholdObjectFormDialog.vue'
import InvestmentFormDialog from '@/components/investments/InvestmentFormDialog.vue'
import InvestmentPriorityList from '@/components/investments/InvestmentPriorityList.vue'
import InvestmentSummaryCard from '@/components/investments/InvestmentSummaryCard.vue'
import MarkPurchasedDialog from '@/components/investments/MarkPurchasedDialog.vue'
import PurchasedInvestmentList from '@/components/investments/PurchasedInvestmentList.vue'
import { useInvestments } from '@/composables/useInvestments'
import { t } from '@/i18n'
import type { CostInput } from '@/types/cost'
import type { HouseholdObjectInput } from '@/types/household-object'
import type { Investment } from '@/types/investment'
import { formatCents } from '@/utils/currency'
import { describeError } from '@/utils/error'

const { planned, purchased, isLoading, error, totalEstimatedCostCents, ensureLoaded, refresh } = useInvestments()
const { moveInvestment, markPlanned, deleteInvestment } = useInvestments()

const isFormDialogOpen = ref(false)
/** null = create mode, otherwise the investment being edited. */
const investmentToEdit = ref<Investment | null>(null)

const isDeleteDialogOpen = ref(false)
const investmentToDelete = ref<Investment | null>(null)

const isPurchaseDialogOpen = ref(false)
const investmentToPurchase = ref<Investment | null>(null)

/** "Convert to inventory object": the object form, filled in from the investment. */
const isObjectDialogOpen = ref(false)
const objectPrefill = ref<HouseholdObjectInput | null>(null)

/** "Record as a cost": the cost form, filled in from the investment (after the object form, if both). */
const isCostDialogOpen = ref(false)
const costPrefill = ref<Partial<CostInput> | null>(null)
/** The purchase whose cost form waits for the object form to close. */
let pendingCost: { investment: Investment; purchasedDate: string } | null = null

/** Error of reordering or moving back to planned. */
const changeError = ref<string | null>(null)

function openCreateDialog(): void {
  investmentToEdit.value = null
  isFormDialogOpen.value = true
}

function openEditDialog(investment: Investment): void {
  investmentToEdit.value = investment
  isFormDialogOpen.value = true
}

function openDeleteDialog(investment: Investment): void {
  investmentToDelete.value = investment
  isDeleteDialogOpen.value = true
}

async function deleteSelected(): Promise<void> {
  if (investmentToDelete.value) await deleteInvestment(investmentToDelete.value.id)
}

function openPurchaseDialog(investment: Investment): void {
  investmentToPurchase.value = investment
  isPurchaseDialogOpen.value = true
}

function openObjectDialog(investment: Investment, purchasedDate: string | null): void {
  objectPrefill.value = {
    name: investment.title,
    categoryId: null,
    purchaseDate: purchasedDate,
    purchasePriceCents: investment.estimatedCostCents,
    notes: investment.description,
  }
  isObjectDialogOpen.value = true
}

function openCostDialog(investment: Investment, paidDate: string): void {
  costPrefill.value = {
    description: investment.title,
    paidDate,
    amountCents: investment.estimatedCostCents,
    costType: 'purchase',
    taxCategoryId: null,
    investmentId: investment.id,
  }
  isCostDialogOpen.value = true
}

function onPurchased(
  investment: Investment,
  purchasedDate: string,
  next: { addToInventory: boolean; recordCost: boolean },
): void {
  if (next.addToInventory) {
    openObjectDialog(investment, purchasedDate)
    pendingCost = next.recordCost ? { investment, purchasedDate } : null
  } else if (next.recordCost) {
    openCostDialog(investment, purchasedDate)
  }
}

// One dialog at a time: the cost form opens when the object form is closed.
watch(isObjectDialogOpen, (isOpen) => {
  if (isOpen || pendingCost === null) return
  const { investment, purchasedDate } = pendingCost
  pendingCost = null
  openCostDialog(investment, purchasedDate)
})

async function change(action: () => Promise<void>): Promise<void> {
  changeError.value = null
  try {
    await action()
  } catch (cause) {
    console.error(cause)
    changeError.value = describeError(cause)
  }
}

onMounted(() => {
  void ensureLoaded()
})
</script>

<template>
  <div>
    <PageHeader :title="t('investments.title')" :subtitle="t('investments.subtitle')">
      <template #actions>
        <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" v-bind="{ onClick: openCreateDialog }">
          {{ t('investments.add') }}
        </v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="error" type="error" class="mb-6" :title="t('investments.loadError')">
      {{ error }}
      <template #append>
        <v-btn variant="text" size="small" v-bind="{ onClick: refresh }">{{ t('common.retry') }}</v-btn>
      </template>
    </v-alert>

    <v-alert v-if="changeError" type="error" class="mb-6" closable @click:close="changeError = null">
      {{ changeError }}
    </v-alert>

    <InvestmentSummaryCard :investments="planned" :total-cents="totalEstimatedCostCents" class="mb-6" />

    <InvestmentPriorityList
      :investments="planned"
      :loading="isLoading"
      @edit="openEditDialog"
      @delete="openDeleteDialog"
      @purchase="openPurchaseDialog"
      @move="(id, toIndex) => change(() => moveInvestment(id, toIndex))"
    />

    <PurchasedInvestmentList
      v-if="purchased.length > 0"
      :investments="purchased"
      class="mt-6"
      @edit="openEditDialog"
      @delete="openDeleteDialog"
      @plan="(investment) => change(() => markPlanned(investment))"
      @to-inventory="(investment) => openObjectDialog(investment, investment.purchasedDate)"
    />

    <InvestmentFormDialog v-model="isFormDialogOpen" :investment="investmentToEdit" />
    <ConfirmDialog v-model="isDeleteDialogOpen" :title="t('investments.delete.title')" :action="deleteSelected">
      <template v-if="investmentToDelete">
        {{
          t('investments.delete.text', {
            title: investmentToDelete.title,
            cost: formatCents(investmentToDelete.estimatedCostCents),
          })
        }}
      </template>
    </ConfirmDialog>
    <MarkPurchasedDialog v-model="isPurchaseDialogOpen" :investment="investmentToPurchase" @purchased="onPurchased" />
    <HouseholdObjectFormDialog v-model="isObjectDialogOpen" :prefill="objectPrefill" />
    <CostFormDialog v-model="isCostDialogOpen" :prefill="costPrefill" />
  </div>
</template>
