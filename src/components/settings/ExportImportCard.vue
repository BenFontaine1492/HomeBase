<script setup lang="ts">
import { ref } from 'vue'
import ImportDataDialog from './ImportDataDialog.vue'
import SettingsActionRow from './SettingsActionRow.vue'
import { useDataTransfer } from '@/composables/useDataTransfer'
import { t } from '@/i18n'
import { describeError } from '@/utils/error'
import type { ExportInfo } from '@/types/data-transfer'

type BusyAction = 'json' | 'csv' | 'import'

const { exportJson, exportCsv, chooseExport } = useDataTransfer()

const busy = ref<BusyAction | null>(null)
const status = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const exportToImport = ref<ExportInfo | null>(null)
const isImportDialogOpen = ref(false)

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

function onExportJson(): Promise<void> {
  return run('json', async () => {
    const path = await exportJson()
    if (path) status.value = { type: 'success', text: t('settings.data.exported', { path }) }
  })
}

function onExportCsv(): Promise<void> {
  return run('csv', async () => {
    const folder = await exportCsv()
    if (folder) status.value = { type: 'success', text: t('settings.data.csvSaved', { folder }) }
  })
}

function onImport(): Promise<void> {
  return run('import', async () => {
    const exported = await chooseExport()
    if (!exported) return
    exportToImport.value = exported
    isImportDialogOpen.value = true
  })
}

function onImported(): void {
  status.value = { type: 'success', text: t('settings.data.imported') }
}

function isDisabled(action: BusyAction): boolean {
  return busy.value !== null && busy.value !== action
}
</script>

<template>
  <v-card class="data-card">
    <div class="data-card__title">{{ t('settings.data.exportTitle') }}</div>

    <SettingsActionRow icon="mdi-code-json" :title="t('settings.data.exportJson')">
      <v-btn
        color="primary"
        variant="flat"
        :loading="busy === 'json'"
        :disabled="isDisabled('json')"
        v-bind="{ onClick: onExportJson }"
      >
        {{ t('settings.data.exportJsonButton') }}
      </v-btn>
    </SettingsActionRow>

    <SettingsActionRow icon="mdi-file-delimited-outline" :title="t('settings.data.exportCsv')">
      <v-btn
        variant="tonal"
        color="primary"
        :loading="busy === 'csv'"
        :disabled="isDisabled('csv')"
        v-bind="{ onClick: onExportCsv }"
      >
        {{ t('settings.data.exportCsvButton') }}
      </v-btn>
    </SettingsActionRow>

    <SettingsActionRow icon="mdi-database-import-outline" :title="t('settings.data.import')">
      <v-btn
        variant="tonal"
        color="primary"
        :loading="busy === 'import'"
        :disabled="isDisabled('import')"
        v-bind="{ onClick: onImport }"
      >
        {{ t('settings.data.importButton') }}
      </v-btn>
    </SettingsActionRow>

    <v-alert v-if="status" :type="status.type" density="compact" class="mt-2" closable @click:close="status = null">
      {{ status.text }}
    </v-alert>

    <ImportDataDialog v-model="isImportDialogOpen" :exported="exportToImport" @imported="onImported" />
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
