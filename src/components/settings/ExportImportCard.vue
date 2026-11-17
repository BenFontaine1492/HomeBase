<script setup lang="ts">
import { ref } from 'vue'
import ImportDataDialog from './ImportDataDialog.vue'
import SettingsActionRow from './SettingsActionRow.vue'
import { useDataTransfer } from '@/composables/useDataTransfer'
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
    if (path) status.value = { type: 'success', text: `Data exported to ${path}` }
  })
}

function onExportCsv(): Promise<void> {
  return run('csv', async () => {
    const folder = await exportCsv()
    if (folder) status.value = { type: 'success', text: `CSV files saved in ${folder}` }
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
  status.value = { type: 'success', text: 'Data imported.' }
}

function isDisabled(action: BusyAction): boolean {
  return busy.value !== null && busy.value !== action
}
</script>

<template>
  <v-card class="data-card">
    <div class="data-card__title">Export &amp; import</div>

    <SettingsActionRow
      icon="mdi-code-json"
      title="Export as JSON"
      text="All data in one file that HomeBase can import again, or that other tools can read."
    >
      <v-btn
        color="primary"
        variant="flat"
        :loading="busy === 'json'"
        :disabled="isDisabled('json')"
        v-bind="{ onClick: onExportJson }"
      >
        Export JSON…
      </v-btn>
    </SettingsActionRow>

    <SettingsActionRow
      icon="mdi-file-delimited-outline"
      title="Export as CSV"
      text="One spreadsheet file per table (investments, categories, objects), e.g. for Excel. CSV files can't be imported."
    >
      <v-btn
        variant="tonal"
        color="primary"
        :loading="busy === 'csv'"
        :disabled="isDisabled('csv')"
        v-bind="{ onClick: onExportCsv }"
      >
        Export CSV…
      </v-btn>
    </SettingsActionRow>

    <SettingsActionRow
      icon="mdi-database-import-outline"
      title="Import from JSON"
      text="Replaces all current data with a HomeBase JSON export. The file is checked first."
    >
      <v-btn
        variant="tonal"
        color="primary"
        :loading="busy === 'import'"
        :disabled="isDisabled('import')"
        v-bind="{ onClick: onImport }"
      >
        Import…
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
