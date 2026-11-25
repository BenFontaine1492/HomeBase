<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ActionsMenu from '@/components/common/ActionsMenu.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ListRow from '@/components/common/ListRow.vue'
import ListSection from '@/components/common/ListSection.vue'
import TaxCategoryFormDialog from '@/components/costs/TaxCategoryFormDialog.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useTaxCategories } from '@/composables/useTaxCategories'
import { t } from '@/i18n'
import type { TaxCategory } from '@/types/tax-category'

/** Settings → Finance: the tax categories costs can be filed under. */
const { categories, error, ensureLoaded, refresh, deleteCategory, addDefaults } = useTaxCategories()
const { isRunning: isAddingDefaults, error: defaultsError, run } = useAsyncAction()

const isFormOpen = ref(false)
const categoryToEdit = ref<TaxCategory | null>(null)
const isDeleteOpen = ref(false)
const categoryToDelete = ref<TaxCategory | null>(null)

function openForm(category: TaxCategory | null): void {
  categoryToEdit.value = category
  isFormOpen.value = true
}

function openDelete(category: TaxCategory): void {
  categoryToDelete.value = category
  isDeleteOpen.value = true
}

async function deleteSelected(): Promise<void> {
  if (categoryToDelete.value) await deleteCategory(categoryToDelete.value.id)
}

function actionsFor(category: TaxCategory) {
  return [
    { title: t('common.edit'), icon: 'mdi-pencil-outline', onSelect: () => openForm(category) },
    { title: t('common.delete'), icon: 'mdi-trash-can-outline', danger: true, onSelect: () => openDelete(category) },
  ]
}

onMounted(() => {
  void ensureLoaded()
})
</script>

<template>
  <div class="hb-sections">
    <v-alert v-if="error" type="error" density="compact">
      {{ t('settings.finance.loadError', { error }) }}
      <template #append>
        <v-btn variant="text" size="small" v-bind="{ onClick: refresh }">{{ t('common.retry') }}</v-btn>
      </template>
    </v-alert>
    <v-alert v-if="defaultsError" type="error" density="compact">{{ defaultsError }}</v-alert>

    <ListSection :title="t('settings.finance.title')" :count="categories.length" :subtitle="t('settings.finance.text')">
      <template #actions>
        <v-btn prepend-icon="mdi-plus" :text="t('settings.finance.add')" v-bind="{ onClick: () => openForm(null) }" />
      </template>

      <ListRow v-for="category in categories" :key="category.id">
        <div class="hb-body">{{ category.name }}</div>
        <div v-if="category.recordsLabourCost" class="hb-caption text-medium-emphasis">
          {{ t('settings.finance.recordsLabour') }}
        </div>
        <template #append>
          <ActionsMenu :label="t('common.actionsFor', { name: category.name })" :actions="actionsFor(category)" />
        </template>
      </ListRow>

      <v-card v-if="categories.length === 0 && !error">
        <EmptyState
          icon="mdi-tag-outline"
          :title="t('settings.finance.emptyTitle')"
          :text="t('settings.finance.emptyText')"
        >
          <v-btn
            :text="t('settings.finance.addDefaults')"
            :loading="isAddingDefaults"
            v-bind="{ onClick: () => run(addDefaults) }"
          />
        </EmptyState>
      </v-card>
    </ListSection>

    <TaxCategoryFormDialog v-model="isFormOpen" :category="categoryToEdit" />
    <ConfirmDialog v-model="isDeleteOpen" :title="t('settings.finance.delete.title')" :action="deleteSelected">
      <template v-if="categoryToDelete">
        {{ t('settings.finance.delete.text', { name: categoryToDelete.name }) }}
      </template>
    </ConfirmDialog>
  </div>
</template>
