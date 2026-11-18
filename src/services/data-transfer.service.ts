import { open, save } from '@tauri-apps/plugin-dialog'
import { t } from '@/i18n'
import { todayIsoDate as today } from '@/utils/date'

/*
 * Backup, restore, export and import. The work happens natively, behind
 * data-transfer.repository.ts; this module adds the native file dialogs with
 * their suggested names and filters. Every path passed to a command comes from a dialog.
 */

function backupFilters(): { name: string; extensions: string[] }[] {
  return [{ name: t('settings.data.dialogs.backupFilter'), extensions: ['db'] }]
}

function exportFilters(): { name: string; extensions: string[] }[] {
  return [{ name: t('settings.data.dialogs.exportFilter'), extensions: ['json'] }]
}

// --- File dialogs (null = the user cancelled) -------------------------------

export function pickBackupDestination(): Promise<string | null> {
  return save({
    title: t('settings.data.dialogs.saveBackup'),
    defaultPath: `homebase-backup-${today()}.db`,
    filters: backupFilters(),
  })
}

export async function pickBackupSource(): Promise<string | null> {
  const path = await open({
    title: t('settings.data.dialogs.chooseBackup'),
    multiple: false,
    directory: false,
    filters: backupFilters(),
  })
  return typeof path === 'string' ? path : null
}

export function pickJsonExportDestination(): Promise<string | null> {
  return save({
    title: t('settings.data.dialogs.exportData'),
    defaultPath: `homebase-export-${today()}.json`,
    filters: exportFilters(),
  })
}

export async function pickCsvExportFolder(): Promise<string | null> {
  const path = await open({ title: t('settings.data.dialogs.chooseCsvFolder'), multiple: false, directory: true })
  return typeof path === 'string' ? path : null
}

export async function pickJsonImportSource(): Promise<string | null> {
  const path = await open({
    title: t('settings.data.dialogs.chooseExport'),
    multiple: false,
    directory: false,
    filters: exportFilters(),
  })
  return typeof path === 'string' ? path : null
}

// --- Commands (no extra rules: passed through from the repository) ----------

export {
  createBackup,
  exportCsv,
  exportJson,
  importJson,
  inspectBackup,
  inspectExport,
  restoreBackup,
} from '@/repositories/data-transfer.repository'
