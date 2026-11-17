<script setup lang="ts">
import { ref, watch } from 'vue'
import DataFileSummary from './DataFileSummary.vue'
import { useDataTransfer } from '@/composables/useDataTransfer'
import { describeError } from '@/utils/error'
import type { ExportInfo } from '@/types/data-transfer'

const props = defineProps<{
  exported: ExportInfo | null
}>()

const emit = defineEmits<{
  imported: []
}>()

const open = defineModel<boolean>({ required: true })

const { importExport } = useDataTransfer()

const isImporting = ref(false)
const importError = ref<string | null>(null)

watch(open, (isOpen) => {
  if (isOpen) importError.value = null
})

async function confirmImport(): Promise<void> {
  if (!props.exported || isImporting.value) return
  isImporting.value = true
  importError.value = null
  try {
    await importExport(props.exported)
    open.value = false
    emit('imported')
  } catch (error) {
    console.error(error)
    importError.value = describeError(error)
  } finally {
    isImporting.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480" :persistent="isImporting">
    <v-card v-if="exported" class="pa-2">
      <div class="px-6 pt-5">
        <div class="import-dialog__icon">
          <v-icon icon="mdi-database-import-outline" color="warning" size="24" />
        </div>
      </div>
      <v-card-title class="text-title-large font-weight-bold px-6">Import this export?</v-card-title>
      <v-card-text class="px-6">
        <DataFileSummary :info="exported" :created-at="exported.exportedAt" />

        <p class="mt-4">
          <strong>All current data will be replaced</strong> by the contents of this file.
          Your current data is kept as <code>homebase.before-import.db</code> in the app data folder.
        </p>

        <v-alert v-if="importError" type="error" class="mt-4" density="compact">
          Nothing was changed. {{ importError }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" :disabled="isImporting" v-bind="{ onClick: () => (open = false) }">Cancel</v-btn>
        <v-btn color="warning" variant="flat" :loading="isImporting" v-bind="{ onClick: confirmImport }">
          Replace data
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.import-dialog__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(var(--v-theme-warning), 0.12);
}
</style>
