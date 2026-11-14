<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import DeleteInvestmentDialog from '@/components/investments/DeleteInvestmentDialog.vue'
import InvestmentFormDialog from '@/components/investments/InvestmentFormDialog.vue'
import InvestmentPriorityList from '@/components/investments/InvestmentPriorityList.vue'
import InvestmentSummaryCard from '@/components/investments/InvestmentSummaryCard.vue'
import { useInvestments } from '@/composables/useInvestments'
import type { Investment } from '@/types/investment'

const { investments, isLoading, error, totalEstimatedCostCents, ensureLoaded, refresh } =
  useInvestments()

const isFormDialogOpen = ref(false)
/** null = create mode, otherwise the investment being edited. */
const investmentToEdit = ref<Investment | null>(null)

const isDeleteDialogOpen = ref(false)
const investmentToDelete = ref<Investment | null>(null)

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

onMounted(() => {
  void ensureLoaded()
})
</script>

<template>
  <div>
    <PageHeader
      title="Future Investments"
      subtitle="Plan and prioritize your upcoming home investments"
    >
      <template #actions>
        <v-btn
          color="primary"
          variant="flat"
          size="large"
          prepend-icon="mdi-plus"
          v-bind="{ onClick: openCreateDialog }"
        >
          Add Investment
        </v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="error" type="error" class="mb-6" title="Could not load investments">
      {{ error }}
      <template #append>
        <v-btn variant="text" size="small" v-bind="{ onClick: refresh }">Retry</v-btn>
      </template>
    </v-alert>

    <InvestmentSummaryCard
      :investments="investments"
      :total-cents="totalEstimatedCostCents"
      class="mb-6"
    />

    <InvestmentPriorityList
      :investments="investments"
      :loading="isLoading"
      @edit="openEditDialog"
      @delete="openDeleteDialog"
    />

    <InvestmentFormDialog v-model="isFormDialogOpen" :investment="investmentToEdit" />
    <DeleteInvestmentDialog v-model="isDeleteDialogOpen" :investment="investmentToDelete" />
  </div>
</template>
