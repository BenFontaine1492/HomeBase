<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Investment } from '@/types/investment'
import { useInvestments } from '@/composables/useInvestments'
import { describeError } from '@/services/database/database-error'
import { formatCents } from '@/utils/currency'

const props = defineProps<{
  investment: Investment | null
}>()

const open = defineModel<boolean>({ required: true })

const { deleteInvestment } = useInvestments()

const isDeleting = ref(false)
const deleteError = ref<string | null>(null)

watch(open, (isOpen) => {
  if (isOpen) deleteError.value = null
})

async function confirmDelete(): Promise<void> {
  if (!props.investment || isDeleting.value) return
  isDeleting.value = true
  deleteError.value = null
  try {
    await deleteInvestment(props.investment.id)
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
    <v-card v-if="investment" class="pa-2">
      <div class="px-6 pt-5">
        <div class="delete-dialog__icon">
          <v-icon icon="mdi-trash-can-outline" color="error" size="24" />
        </div>
      </div>
      <v-card-title class="text-title-large font-weight-bold px-6">Delete investment?</v-card-title>
      <v-card-text class="px-6">
        <strong>{{ investment.title }}</strong>
        ({{ formatCents(investment.estimatedCostCents) }}) will be permanently removed. This
        cannot be undone.

        <v-alert v-if="deleteError" type="error" class="mt-4" density="compact">
          {{ deleteError }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" :disabled="isDeleting" @click="open = false">Cancel</v-btn>
        <v-btn color="error" variant="flat" :loading="isDeleting" @click="confirmDelete">
          Delete
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
</style>
