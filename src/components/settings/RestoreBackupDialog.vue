<script setup lang="ts">
import { ref, watch } from 'vue'
import DataFileSummary from './DataFileSummary.vue'
import { useDataTransfer } from '@/composables/useDataTransfer'
import { describeError } from '@/utils/error'
import type { BackupInfo } from '@/types/data-transfer'

const props = defineProps<{
  backup: BackupInfo | null
}>()

const emit = defineEmits<{
  restored: []
}>()

const open = defineModel<boolean>({ required: true })

const { restoreBackup } = useDataTransfer()

const isRestoring = ref(false)
const restoreError = ref<string | null>(null)

watch(open, (isOpen) => {
  if (isOpen) restoreError.value = null
})

async function confirmRestore(): Promise<void> {
  if (!props.backup || isRestoring.value) return
  isRestoring.value = true
  restoreError.value = null
  try {
    await restoreBackup(props.backup)
    open.value = false
    emit('restored')
  } catch (error) {
    console.error(error)
    restoreError.value = describeError(error)
  } finally {
    isRestoring.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480" :persistent="isRestoring">
    <v-card v-if="backup" class="pa-2">
      <div class="px-6 pt-5">
        <div class="restore-dialog__icon">
          <v-icon icon="mdi-backup-restore" color="warning" size="24" />
        </div>
      </div>
      <v-card-title class="text-title-large font-weight-bold px-6">Restore this backup?</v-card-title>
      <v-card-text class="px-6">
        <DataFileSummary :info="backup" />

        <p class="mt-4">
          <strong>All current data will be replaced</strong> by this backup.
          Your current data is kept as <code>homebase.before-restore.db</code> in the app data folder.
        </p>

        <v-alert v-if="restoreError" type="error" class="mt-4" density="compact">
          {{ restoreError }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" :disabled="isRestoring" v-bind="{ onClick: () => (open = false) }">Cancel</v-btn>
        <v-btn color="warning" variant="flat" :loading="isRestoring" v-bind="{ onClick: confirmRestore }">
          Restore
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.restore-dialog__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(var(--v-theme-warning), 0.12);
}
</style>
