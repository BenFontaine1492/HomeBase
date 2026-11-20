<script setup lang="ts">
import DataFileSummary from './DataFileSummary.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { useDataTransfer } from '@/composables/useDataTransfer'
import { t } from '@/i18n'
import type { ExportInfo } from '@/types/data-transfer'
import { describeError } from '@/utils/error'

/** "Import this export?", with a summary of the file. */
const props = defineProps<{
  exported: ExportInfo | null
}>()

const emit = defineEmits<{
  imported: []
}>()

const open = defineModel<boolean>({ required: true })

const { importExport } = useDataTransfer()

async function importData(): Promise<void> {
  if (!props.exported) return
  try {
    await importExport(props.exported)
  } catch (error) {
    // The import runs in one transaction: say that nothing was changed.
    throw new Error(t('settings.data.importDialog.nothingChanged', { error: describeError(error) }), { cause: error })
  }
  emit('imported')
}
</script>

<template>
  <ConfirmDialog
    v-model="open"
    :title="t('settings.data.importDialog.title')"
    :confirm-label="t('settings.data.importDialog.confirm')"
    tone="warning"
    :action="importData"
  >
    <template v-if="exported">
      <DataFileSummary :info="exported" :created-at="exported.exportedAt" />
      <p class="mt-4">
        <strong>{{ t('settings.data.importDialog.replaced') }}</strong>
        {{ t('settings.data.keptAs', { file: 'homebase.before-import.db' }) }}
      </p>
      <p class="mt-2">{{ t('settings.data.importDialog.documents', { folder: 'attachments.before-import' }) }}</p>
    </template>
  </ConfirmDialog>
</template>
