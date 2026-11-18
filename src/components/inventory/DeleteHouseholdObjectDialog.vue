<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { HouseholdObject } from '@/types/household-object'
import { useAttachments } from '@/composables/useAttachments'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { useMaintenance } from '@/composables/useMaintenance'
import { describeError } from '@/utils/error'

const props = defineProps<{
  object: HouseholdObject | null
}>()

const emit = defineEmits<{
  deleted: []
}>()

const open = defineModel<boolean>({ required: true })

const { deleteObject } = useHouseholdObjects()
const { attachmentsOf } = useAttachments()
const { tasksOf, recordsOf } = useMaintenance()

/** What is deleted with the object (ON DELETE CASCADE), e.g. "3 documents, 1 maintenance task". */
const alsoDeleted = computed<string | null>(() => {
  if (!props.object) return null
  const { id } = props.object
  const parts = [
    counted(attachmentsOf({ kind: 'object', id }).length, 'document', 'documents'),
    counted(tasksOf(id).length, 'maintenance task', 'maintenance tasks'),
    counted(recordsOf(id).length, 'history entry', 'history entries'),
  ].filter((part) => part !== null)
  return parts.length > 0 ? parts.join(', ') : null
})

function counted(count: number, one: string, many: string): string | null {
  if (count === 0) return null
  return `${count} ${count === 1 ? one : many}`
}

const isDeleting = ref(false)
const deleteError = ref<string | null>(null)

watch(open, (isOpen) => {
  if (isOpen) deleteError.value = null
})

async function confirmDelete(): Promise<void> {
  if (!props.object || isDeleting.value) return
  isDeleting.value = true
  deleteError.value = null
  try {
    await deleteObject(props.object.id)
    open.value = false
    emit('deleted')
  } catch (error) {
    console.error(error)
    deleteError.value = describeError(error)
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440" :persistent="isDeleting">
    <v-card v-if="object" class="pa-2">
      <div class="px-6 pt-5">
        <div class="delete-dialog__icon">
          <v-icon icon="mdi-trash-can-outline" color="error" size="24" />
        </div>
      </div>
      <v-card-title class="text-title-large font-weight-bold px-6">Delete object?</v-card-title>
      <v-card-text class="px-6">
        <strong>{{ object.name }}</strong> will be permanently removed. This cannot be undone.
        <p v-if="alsoDeleted" class="mt-2">This also deletes its {{ alsoDeleted }}.</p>

        <v-alert v-if="deleteError" type="error" class="mt-4" density="compact">
          {{ deleteError }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" :disabled="isDeleting" v-bind="{ onClick: () => (open = false) }">Cancel</v-btn>
        <v-btn color="error" variant="flat" :loading="isDeleting" v-bind="{ onClick: confirmDelete }"> Delete </v-btn>
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
</style>
