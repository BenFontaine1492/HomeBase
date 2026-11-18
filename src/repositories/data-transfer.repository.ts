import type { BackupInfo, ExportInfo } from '@/types/data-transfer'
import { callCommand as call } from './native-command'

/*
 * The native backup, restore, export and import commands
 * (`src-tauri/src/data_transfer/`). Every path comes from a file dialog
 * (see data-transfer.service.ts).
 */

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
