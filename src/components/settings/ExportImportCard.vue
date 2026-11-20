<script setup lang="ts">
import { ref } from 'vue'
import ImportDataDialog from './ImportDataDialog.vue'
import SettingsRow from './SettingsRow.vue'
import ListSection from '@/components/common/ListSection.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useDataTransfer } from '@/composables/useDataTransfer'
import { useNotifications } from '@/composables/useNotifications'
import { t } from '@/i18n'
import type { ExportInfo } from '@/types/data-transfer'

const { exportJson, exportCsv, chooseExport } = useDataTransfer()
const { notify } = useNotifications()
const { current, error, run, isDisabled } = useAsyncAction<'json' | 'csv' | 'import'>()

const exportToImport = ref<ExportInfo | null>(null)
const isImportDialogOpen = ref(false)

function onExportJson(): Promise<void> {
  return run(async () => {
    const path = await exportJson()
    if (path) notify(t('settings.data.exported', { path }))
  }, 'json')
}

function onExportCsv(): Promise<void> {
  return run(async () => {
    const folder = await exportCsv()
    if (folder) notify(t('settings.data.csvSaved', { folder }))
  }, 'csv')
}

function onImport(): Promise<void> {
  return run(async () => {
    const exported = await chooseExport()
    if (!exported) return
    exportToImport.value = exported
    isImportDialogOpen.value = true
  }, 'import')
}
</script>

<template>
  <ListSection :title="t('settings.data.exportTitle')">
    <SettingsRow icon="mdi-code-json" :title="t('settings.data.exportJson')">
      <v-btn :loading="current === 'json'" :disabled="isDisabled('json')" v-bind="{ onClick: onExportJson }">
        {{ t('settings.data.exportJsonButton') }}
      </v-btn>
    </SettingsRow>
    <SettingsRow icon="mdi-file-delimited-outline" :title="t('settings.data.exportCsv')">
      <v-btn :loading="current === 'csv'" :disabled="isDisabled('csv')" v-bind="{ onClick: onExportCsv }">
        {{ t('settings.data.exportCsvButton') }}
      </v-btn>
    </SettingsRow>
    <SettingsRow icon="mdi-database-import-outline" :title="t('settings.data.import')">
      <v-btn :loading="current === 'import'" :disabled="isDisabled('import')" v-bind="{ onClick: onImport }">
        {{ t('settings.data.importButton') }}
      </v-btn>
    </SettingsRow>
    <v-alert v-if="error" type="error" density="compact" closable @click:close="error = null">{{ error }}</v-alert>
  </ListSection>

  <ImportDataDialog
    v-model="isImportDialogOpen"
    :exported="exportToImport"
    @imported="notify(t('settings.data.imported'))"
  />
</template>
