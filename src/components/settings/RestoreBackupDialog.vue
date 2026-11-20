<script setup lang="ts">
import DataFileSummary from './DataFileSummary.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { useDataTransfer } from '@/composables/useDataTransfer'
import { t } from '@/i18n'
import type { BackupInfo } from '@/types/data-transfer'

/** "Restore this backup?", with a summary of the backup. */
const props = defineProps<{
  backup: BackupInfo | null
}>()

const emit = defineEmits<{
  restored: []
}>()

const open = defineModel<boolean>({ required: true })

const { restoreBackup } = useDataTransfer()

async function restore(): Promise<void> {
  if (!props.backup) return
  await restoreBackup(props.backup)
  emit('restored')
}
</script>

<template>
  <ConfirmDialog
    v-model="open"
    :title="t('settings.data.restoreDialog.title')"
    :confirm-label="t('settings.data.restoreDialog.confirm')"
    tone="warning"
    :action="restore"
  >
    <template v-if="backup">
      <DataFileSummary :info="backup" />
      <p class="mt-4">
        <strong>{{ t('settings.data.restoreDialog.replaced') }}</strong>
        {{ t('settings.data.keptAs', { file: 'homebase.before-restore.db' }) }}
      </p>
      <p class="mt-2">{{ t('settings.data.restoreDialog.documents', { folder: 'attachments.before-restore' }) }}</p>
    </template>
  </ConfirmDialog>
</template>
