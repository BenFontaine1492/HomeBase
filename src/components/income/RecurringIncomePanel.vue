<script setup lang="ts">
import { ref } from 'vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ListSection from '@/components/common/ListSection.vue'
import RecurringIncomeFormDialog from './RecurringIncomeFormDialog.vue'
import RecurringIncomeListItem from './RecurringIncomeListItem.vue'
import { useRecurringIncome } from '@/composables/useRecurringIncome'
import { t } from '@/i18n'
import type { RecurringIncome } from '@/types/recurring-income'

/** The recurring income on the "Recurring" tab of the Finances page: the rules, with create/edit/delete. */
const { rules, isLoading, deleteRule } = useRecurringIncome()

const isFormOpen = ref(false)
const ruleToEdit = ref<RecurringIncome | null>(null)
const isDeleteOpen = ref(false)
const ruleToDelete = ref<RecurringIncome | null>(null)

function openForm(rule: RecurringIncome | null): void {
  ruleToEdit.value = rule
  isFormOpen.value = true
}

function openDelete(rule: RecurringIncome): void {
  ruleToDelete.value = rule
  isDeleteOpen.value = true
}

async function deleteSelected(): Promise<void> {
  if (ruleToDelete.value) await deleteRule(ruleToDelete.value.id)
}
</script>

<template>
  <ListSection :title="t('income.recurring.title')" :count="rules.length" :subtitle="t('income.recurring.subtitle')">
    <template #actions>
      <v-btn prepend-icon="mdi-plus" :text="t('income.recurring.add')" v-bind="{ onClick: () => openForm(null) }" />
    </template>
    <RecurringIncomeListItem v-for="rule in rules" :key="rule.id" :rule="rule" @edit="openForm" @delete="openDelete" />
    <v-card v-if="rules.length === 0 && !isLoading">
      <EmptyState
        icon="mdi-autorenew"
        :title="t('income.recurring.emptyTitle')"
        :text="t('income.recurring.emptyText')"
      />
    </v-card>
  </ListSection>

  <RecurringIncomeFormDialog v-model="isFormOpen" :rule="ruleToEdit" />
  <ConfirmDialog v-model="isDeleteOpen" :title="t('income.recurring.delete.title')" :action="deleteSelected">
    <template v-if="ruleToDelete">
      {{ t('income.recurring.delete.text', { name: ruleToDelete.description }) }}
    </template>
  </ConfirmDialog>
</template>
