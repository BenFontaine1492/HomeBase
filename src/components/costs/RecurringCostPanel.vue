<script setup lang="ts">
import { ref } from 'vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ListSection from '@/components/common/ListSection.vue'
import RecurringCostFormDialog from './RecurringCostFormDialog.vue'
import RecurringCostListItem from './RecurringCostListItem.vue'
import { useRecurringCosts } from '@/composables/useRecurringCosts'
import { t } from '@/i18n'
import type { RecurringCost } from '@/types/recurring-cost'

/** The recurring costs on the "Recurring" tab of the Finances page: the rules, with create/edit/delete. */
const { rules, isLoading, deleteRule } = useRecurringCosts()

const isFormOpen = ref(false)
const ruleToEdit = ref<RecurringCost | null>(null)
const isDeleteOpen = ref(false)
const ruleToDelete = ref<RecurringCost | null>(null)

function openForm(rule: RecurringCost | null): void {
  ruleToEdit.value = rule
  isFormOpen.value = true
}

function openDelete(rule: RecurringCost): void {
  ruleToDelete.value = rule
  isDeleteOpen.value = true
}

async function deleteSelected(): Promise<void> {
  if (ruleToDelete.value) await deleteRule(ruleToDelete.value.id)
}
</script>

<template>
  <ListSection :title="t('costs.recurring.title')" :count="rules.length" :subtitle="t('costs.recurring.subtitle')">
    <template #actions>
      <v-btn prepend-icon="mdi-plus" :text="t('costs.recurring.add')" v-bind="{ onClick: () => openForm(null) }" />
    </template>
    <RecurringCostListItem v-for="rule in rules" :key="rule.id" :rule="rule" @edit="openForm" @delete="openDelete" />
    <v-card v-if="rules.length === 0 && !isLoading">
      <EmptyState
        icon="mdi-autorenew"
        :title="t('costs.recurring.emptyTitle')"
        :text="t('costs.recurring.emptyText')"
      />
    </v-card>
  </ListSection>

  <RecurringCostFormDialog v-model="isFormOpen" :rule="ruleToEdit" />
  <ConfirmDialog v-model="isDeleteOpen" :title="t('costs.recurring.delete.title')" :action="deleteSelected">
    <template v-if="ruleToDelete">
      {{ t('costs.recurring.delete.text', { name: ruleToDelete.description }) }}
    </template>
  </ConfirmDialog>
</template>
