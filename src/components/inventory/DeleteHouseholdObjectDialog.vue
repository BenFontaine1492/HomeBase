<script setup lang="ts">
import { computed, watch } from 'vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { useAttachments } from '@/composables/useAttachments'
import { useCosts } from '@/composables/useCosts'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { useMaintenance } from '@/composables/useMaintenance'
import { t } from '@/i18n'
import type { HouseholdObject } from '@/types/household-object'

/** "Delete object?", listing what is deleted with it (its documents, tasks and history). */
const props = defineProps<{
  object: HouseholdObject | null
}>()

const open = defineModel<boolean>({ required: true })

const { deleteObject } = useHouseholdObjects()
const { attachmentsOf } = useAttachments()
const { tasksOf, recordsOf } = useMaintenance()
const { costs, ensureLoaded: loadCosts } = useCosts()

watch(open, (isOpen) => {
  if (isOpen) void loadCosts()
})

/** Costs linked to the object directly: they stay, without the link (ON DELETE SET NULL). */
const keptCostCount = computed<number>(
  () => costs.value.filter((cost) => props.object !== null && cost.householdObjectId === props.object.id).length,
)

/** What is deleted with the object (ON DELETE CASCADE), e.g. "3 documents, 1 maintenance task". */
const alsoDeleted = computed<string | null>(() => {
  if (!props.object) return null
  const { id } = props.object
  const parts = [
    counted(attachmentsOf({ kind: 'object', id }).length, 'common.documentCount'),
    counted(tasksOf(id).length, 'objects.delete.taskCount'),
    counted(recordsOf(id).length, 'objects.delete.recordCount'),
  ].filter((part) => part !== null)
  return parts.length > 0 ? parts.join(', ') : null
})

function counted(
  count: number,
  key: 'common.documentCount' | 'objects.delete.taskCount' | 'objects.delete.recordCount',
): string | null {
  return count === 0 ? null : t(key, { count })
}

async function deleteSelected(): Promise<void> {
  if (props.object) await deleteObject(props.object.id)
}
</script>

<template>
  <ConfirmDialog v-model="open" :title="t('objects.delete.title')" :action="deleteSelected">
    <template v-if="object">
      {{ t('objects.delete.text', { name: object.name }) }}
      <p v-if="alsoDeleted" class="mt-2">{{ t('objects.delete.alsoDeleted', { items: alsoDeleted }) }}</p>
      <p v-if="keptCostCount > 0" class="mt-2">{{ t('objects.delete.costsKept', { count: keptCostCount }) }}</p>
    </template>
  </ConfirmDialog>
</template>
