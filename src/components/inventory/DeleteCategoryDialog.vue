<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { uncategorizedLabel, type HouseholdCategory } from '@/types/household-category'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { t } from '@/i18n'
import { describeError } from '@/utils/error'

const props = defineProps<{
  category: HouseholdCategory | null
  /** Number of objects currently assigned to the category. */
  objectCount: number
}>()

const emit = defineEmits<{
  deleted: []
}>()

const open = defineModel<boolean>({ required: true })

const { deleteCategory } = useHouseholdCategories()

/** Which button is busy, so only that one shows a spinner. */
const pendingAction = ref<'keep' | 'delete' | null>(null)
const deleteError = ref<string | null>(null)

const keepText = computed<string>(() =>
  t('inventory.deleteCategory.containsObjects', { count: props.objectCount, uncategorized: uncategorizedLabel() }),
)

watch(open, (isOpen) => {
  if (isOpen) deleteError.value = null
})

async function confirmDelete(deleteObjects: boolean): Promise<void> {
  if (!props.category || pendingAction.value) return
  pendingAction.value = deleteObjects ? 'delete' : 'keep'
  deleteError.value = null
  try {
    await deleteCategory(props.category.id, { deleteObjects })
    open.value = false
    emit('deleted')
  } catch (error) {
    console.error(error)
    deleteError.value = describeError(error)
  } finally {
    pendingAction.value = null
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480" :persistent="pendingAction !== null">
    <v-card v-if="category" class="pa-2">
      <div class="px-6 pt-5">
        <div class="delete-dialog__icon">
          <v-icon icon="mdi-trash-can-outline" color="error" size="24" />
        </div>
      </div>
      <v-card-title class="text-title-large font-weight-bold px-6 delete-dialog__title">
        {{ t('inventory.deleteCategory.title', { name: category.name }) }}
      </v-card-title>
      <v-card-text class="px-6">
        <template v-if="objectCount > 0">{{ keepText }}</template>
        <template v-else>{{ t('inventory.deleteCategory.empty') }}</template>

        <v-alert v-if="deleteError" type="error" class="mt-4" density="compact">
          {{ deleteError }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="px-6 pb-4 flex-wrap">
        <v-spacer />
        <v-btn variant="text" :disabled="pendingAction !== null" v-bind="{ onClick: () => (open = false) }">
          {{ t('common.cancel') }}
        </v-btn>
        <template v-if="objectCount > 0">
          <v-btn
            variant="tonal"
            :loading="pendingAction === 'keep'"
            :disabled="pendingAction === 'delete'"
            v-bind="{ onClick: () => confirmDelete(false) }"
          >
            {{ t('inventory.deleteCategory.keep') }}
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="pendingAction === 'delete'"
            :disabled="pendingAction === 'keep'"
            v-bind="{ onClick: () => confirmDelete(true) }"
          >
            {{ t('inventory.deleteCategory.deleteToo') }}
          </v-btn>
        </template>
        <v-btn
          v-else
          color="error"
          variant="flat"
          :loading="pendingAction !== null"
          v-bind="{ onClick: () => confirmDelete(false) }"
        >
          {{ t('common.delete') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.delete-dialog__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(var(--v-theme-error), 0.1);
}

.delete-dialog__title {
  white-space: normal;
}
</style>
