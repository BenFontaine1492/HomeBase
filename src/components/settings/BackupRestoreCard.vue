<script setup lang="ts">
import { ref } from 'vue'
import RestoreBackupDialog from './RestoreBackupDialog.vue'
import SettingsActionRow from './SettingsActionRow.vue'
import { useDataTransfer } from '@/composables/useDataTransfer'
import { t } from '@/i18n'
import { describeError } from '@/utils/error'
import type { BackupInfo } from '@/types/data-transfer'

type BusyAction = 'backup' | 'restore'

const { createBackup, chooseBackup } = useDataTransfer()

const busy = ref<BusyAction | null>(null)
const status = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const backupToRestore = ref<BackupInfo | null>(null)
const isRestoreDialogOpen = ref(false)

async function run(action: BusyAction, task: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = action
  status.value = null
  try {
    await task()
  } catch (error) {
    console.error(error)
    status.value = { type: 'error', text: describeError(error) }
  } finally {
    busy.value = null
  }
}

function onCreateBackup(): Promise<void> {
  return run('backup', async () => {
    const path = await createBackup()
    if (path) status.value = { type: 'success', text: t('settings.data.backupSaved', { path }) }
  })
}

function onRestore(): Promise<void> {
  return run('restore', async () => {
    const backup = await chooseBackup()
    if (!backup) return
    backupToRestore.value = backup
    isRestoreDialogOpen.value = true
  })
}
</script>

<template>
  <v-card class="data-card">
    <div class="data-card__title">{{ t('settings.data.backupTitle') }}</div>

    <SettingsActionRow
      icon="mdi-database-export-outline"
      :title="t('settings.data.createBackup')"
      :text="t('settings.data.createBackupText')"
    >
      <v-btn
        color="primary"
        variant="flat"
        :loading="busy === 'backup'"
        :disabled="busy !== null && busy !== 'backup'"
        v-bind="{ onClick: onCreateBackup }"
      >
        {{ t('settings.data.createBackupButton') }}
      </v-btn>
    </SettingsActionRow>

    <SettingsActionRow
      icon="mdi-backup-restore"
      :title="t('settings.data.restore')"
      :text="t('settings.data.restoreText')"
    >
      <v-btn
        variant="tonal"
        color="primary"
        :loading="busy === 'restore'"
        :disabled="busy !== null && busy !== 'restore'"
        v-bind="{ onClick: onRestore }"
      >
        {{ t('settings.data.restoreButton') }}
      </v-btn>
    </SettingsActionRow>

    <v-alert v-if="status" :type="status.type" density="compact" class="mt-2" closable @click:close="status = null">
      {{ status.text }}
    </v-alert>

    <RestoreBackupDialog
      v-model="isRestoreDialogOpen"
      :backup="backupToRestore"
      @restored="status = { type: 'success', text: t('settings.data.restored') }"
    />
  </v-card>
</template>

<style scoped>
.data-card {
  padding: 20px 24px;
}

.data-card__title {
  font-size: 1.0625rem;
  font-weight: 700;
}
</style>
