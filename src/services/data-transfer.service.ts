import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { describeError } from './database/database-error'
import { logError } from './log.service'
import type { BackupInfo, ExportInfo } from '@/types/data-transfer'

/*
 * Backup, restore, export and import. The work happens natively
 * (`src-tauri/src/data_transfer.rs`); this module wraps the commands and the
 * native file dialogs. Every path passed to a command comes from a dialog.
 */

const BACKUP_FILTERS = [{ name: 'HomeBase backup', extensions: ['db'] }]
const EXPORT_FILTERS = [{ name: 'HomeBase export (JSON)', extensions: ['json'] }]

/** Commands reject with plain strings; turn them into `Error`s. */
async function call<T>(command: string, args: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args)
  } catch (error) {
    const message = describeError(error)
    logError(`Command ${command} failed: ${message}`)
    throw new Error(message)
  }
}

/** Local date as YYYY-MM-DD, for suggested file names. */
function today(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// --- File dialogs (null = the user cancelled) -------------------------------

export function pickBackupDestination(): Promise<string | null> {
  return save({ title: 'Save backup', defaultPath: `homebase-backup-${today()}.db`, filters: BACKUP_FILTERS })
}

export async function pickBackupSource(): Promise<string | null> {
  const path = await open({ title: 'Choose a backup to restore', multiple: false, directory: false, filters: BACKUP_FILTERS })
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
  const path = await open({ title: 'Choose an export to import', multiple: false, directory: false, filters: EXPORT_FILTERS })
  return typeof path === 'string' ? path : null
}

// --- Commands ----------------------------------------------------------------

export function createBackup(destination: string): Promise<void> {
  return call('create_backup', { destination })
}

/** Validates a backup (integrity, schema version) without changing anything. */
export function inspectBackup(source: string): Promise<BackupInfo> {
  return call('inspect_backup', { source })
}

/** Swaps the backup in place of the live database (older backups are migrated). */
export function restoreBackup(source: string): Promise<void> {
  return call('restore_backup', { source })
}

export function exportJson(destination: string): Promise<void> {
  return call('export_json', { destination })
}

/** Returns the folder that was created for the CSV files. */
export function exportCsv(directory: string): Promise<string> {
  return call('export_csv', { directory })
}

/** Validates a JSON export without changing anything. */
export function inspectExport(source: string): Promise<ExportInfo> {
  return call('inspect_export', { source })
}

/** Replaces all data with the export's contents (one transaction). */
export function importJson(source: string): Promise<void> {
  return call('import_json', { source })
}
