import { open, save } from '@tauri-apps/plugin-dialog'
import { todayIsoDate as today } from '@/utils/date'

/*
 * Backup, restore, export and import. The work happens natively, behind
 * data-transfer.repository.ts; this module adds the native file dialogs with
 * their suggested names and filters. Every path passed to a command comes from a dialog.
 */

const BACKUP_FILTERS = [{ name: 'HomeBase backup', extensions: ['db'] }]
const EXPORT_FILTERS = [{ name: 'HomeBase export (JSON)', extensions: ['json'] }]

// --- File dialogs (null = the user cancelled) -------------------------------

export function pickBackupDestination(): Promise<string | null> {
  return save({ title: 'Save backup', defaultPath: `homebase-backup-${today()}.db`, filters: BACKUP_FILTERS })
}

export async function pickBackupSource(): Promise<string | null> {
  const path = await open({
    title: 'Choose a backup to restore',
    multiple: false,
    directory: false,
    filters: BACKUP_FILTERS,
  })
  return typeof path === 'string' ? path : null
}

export function pickJsonExportDestination(): Promise<string | null> {
  return save({ title: 'Export data', defaultPath: `homebase-export-${today()}.json`, filters: EXPORT_FILTERS })
}

export async function pickCsvExportFolder(): Promise<string | null> {
  const path = await open({ title: 'Choose a folder for the CSV files', multiple: false, directory: true })
  return typeof path === 'string' ? path : null
}

export async function pickJsonImportSource(): Promise<string | null> {
  const path = await open({
    title: 'Choose an export to import',
    multiple: false,
    directory: false,
    filters: EXPORT_FILTERS,
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
