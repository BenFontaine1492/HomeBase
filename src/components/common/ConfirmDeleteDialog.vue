<script setup lang="ts">
import { ref, watch } from 'vue'
import { describeError } from '@/utils/error'

/**
 * "Delete …?" confirmation. `action` does the deleting; the dialog shows its
 * progress and error, and closes when it succeeds. The default slot is the text.
 */
const props = defineProps<{
  title: string
  action: () => Promise<void>
}>()

const open = defineModel<boolean>({ required: true })

const isDeleting = ref(false)
const deleteError = ref<string | null>(null)

watch(open, (isOpen) => {
  if (isOpen) deleteError.value = null
})

async function confirmDelete(): Promise<void> {
  if (isDeleting.value) return
  isDeleting.value = true
  deleteError.value = null
  try {
    await props.action()
    open.value = false
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
    <v-card class="pa-2">
      <div class="px-6 pt-5">
        <div class="confirm-delete__icon">
          <v-icon icon="mdi-trash-can-outline" color="error" size="24" />
        </div>
      </div>
      <v-card-title class="text-title-large font-weight-bold px-6">{{ title }}</v-card-title>
      <v-card-text class="px-6">
        <slot />

        <v-alert v-if="deleteError" type="error" class="mt-4" density="compact">
          {{ deleteError }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" :disabled="isDeleting" v-bind="{ onClick: () => (open = false) }">Cancel</v-btn>
        <v-btn color="error" variant="flat" :loading="isDeleting" v-bind="{ onClick: confirmDelete }">Delete</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.confirm-delete__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(var(--v-theme-error), 0.1);
}
</style>
