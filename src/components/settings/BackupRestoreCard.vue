<script setup lang="ts">
import { ref } from 'vue'
import RestoreBackupDialog from './RestoreBackupDialog.vue'
import SettingsRow from './SettingsRow.vue'
import ListSection from '@/components/common/ListSection.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useDataTransfer } from '@/composables/useDataTransfer'
import { useNotifications } from '@/composables/useNotifications'
import { t } from '@/i18n'
import type { BackupInfo } from '@/types/data-transfer'

const { createBackup, chooseBackup } = useDataTransfer()
const { notify } = useNotifications()
const { current, error, run, isDisabled } = useAsyncAction<'backup' | 'restore'>()

const backupToRestore = ref<BackupInfo | null>(null)
const isRestoreDialogOpen = ref(false)

function onCreateBackup(): Promise<void> {
  return run(async () => {
    const path = await createBackup()
    if (path) notify(t('settings.data.backupSaved', { path }))
  }, 'backup')
}

function onRestore(): Promise<void> {
  return run(async () => {
    const backup = await chooseBackup()
    if (!backup) return
    backupToRestore.value = backup
    isRestoreDialogOpen.value = true
  }, 'restore')
}
</script>

<template>
  <ListSection :title="t('settings.data.backupTitle')">
    <SettingsRow
      icon="mdi-database-export-outline"
      :title="t('settings.data.createBackup')"
      :description="t('settings.data.createBackupText')"
    >
      <v-btn
        color="primary"
        variant="flat"
        :loading="current === 'backup'"
        :disabled="isDisabled('backup')"
        v-bind="{ onClick: onCreateBackup }"
      >
        {{ t('settings.data.createBackupButton') }}
      </v-btn>
    </SettingsRow>
    <SettingsRow
      icon="mdi-backup-restore"
      :title="t('settings.data.restore')"
      :description="t('settings.data.restoreText')"
    >
      <v-btn :loading="current === 'restore'" :disabled="isDisabled('restore')" v-bind="{ onClick: onRestore }">
        {{ t('settings.data.restoreButton') }}
      </v-btn>
    </SettingsRow>
    <v-alert v-if="error" type="error" density="compact" closable @click:close="error = null">{{ error }}</v-alert>
  </ListSection>

  <RestoreBackupDialog
    v-model="isRestoreDialogOpen"
    :backup="backupToRestore"
    @restored="notify(t('settings.data.restored'))"
  />
</template>
