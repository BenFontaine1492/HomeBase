<script setup lang="ts">
import { computed, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { t } from '@/i18n'
import { uncategorizedLabel, type HouseholdCategory } from '@/types/household-category'

/** "Delete category?": with objects in it, they can be kept (as uncategorized) or deleted too. */
const props = defineProps<{
  category: HouseholdCategory | null
  /** Number of objects currently assigned to the category. */
  objectCount: number
}>()

const open = defineModel<boolean>({ required: true })

const { deleteCategory } = useHouseholdCategories()
/** `current` is the button that is busy, so only that one shows a spinner. */
const { isRunning, current, error, run } = useAsyncAction<'keep' | 'delete'>()

const text = computed<string>(() =>
  props.objectCount > 0
    ? t('inventory.deleteCategory.containsObjects', { count: props.objectCount, uncategorized: uncategorizedLabel() })
    : t('inventory.deleteCategory.empty'),
)

watch(open, (isOpen) => {
  if (isOpen) error.value = null
})

function confirmDelete(deleteObjects: boolean): Promise<void> {
  const { category } = props
  if (!category) return Promise.resolve()
  return run(
    async () => {
      await deleteCategory(category.id, { deleteObjects })
      open.value = false
    },
    deleteObjects ? 'delete' : 'keep',
  )
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="category ? t('inventory.deleteCategory.title', { name: category.name }) : ''"
    :busy="isRunning"
  >
    {{ text }}
    <v-alert v-if="error" type="error" density="compact" class="mt-4">{{ error }}</v-alert>

    <template #actions>
      <template v-if="objectCount > 0">
        <v-btn
          color="primary"
          variant="flat"
          :loading="current === 'keep'"
          :disabled="current === 'delete'"
          v-bind="{ onClick: () => confirmDelete(false) }"
        >
          {{ t('inventory.deleteCategory.keep') }}
        </v-btn>
        <v-btn
          color="error"
          :loading="current === 'delete'"
          :disabled="current === 'keep'"
          v-bind="{ onClick: () => confirmDelete(true) }"
        >
          {{ t('inventory.deleteCategory.deleteToo') }}
        </v-btn>
      </template>
      <v-btn v-else color="error" variant="flat" :loading="isRunning" v-bind="{ onClick: () => confirmDelete(false) }">
        {{ t('common.delete') }}
      </v-btn>
      <v-btn :disabled="isRunning" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>
