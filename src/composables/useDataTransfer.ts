import * as dataTransfer from '@/services/data-transfer.service'
import { reloadObjectChildren } from './reloadObjectChildren'
import { useHouseholdCategories } from './useHouseholdCategories'
import { useHouseholdObjects } from './useHouseholdObjects'
import { useInvestments } from './useInvestments'
import { useSettings } from './useSettings'
import type { BackupInfo, ExportInfo } from '@/types/data-transfer'

/*
 * Backup, restore, export and import. No shared state: each card or dialog
 * owns its busy/error state. Every method rethrows so the caller can show the
 * error. Methods that open a file dialog return null when the user cancels.
 */

/** Saves a backup. Returns the chosen path. */
async function createBackup(): Promise<string | null> {
  const destination = await dataTransfer.pickBackupDestination()
  if (!destination) return null
  await dataTransfer.createBackup(destination)
  return destination
}

/** Lets the user pick a backup and validates it. Nothing is changed yet. */
async function chooseBackup(): Promise<BackupInfo | null> {
  const source = await dataTransfer.pickBackupSource()
  return source ? dataTransfer.inspectBackup(source) : null
}

/** After a restore or import every list shows different data, so reload them all. */
async function reloadAllData(): Promise<void> {
  await Promise.all([
    useInvestments().refresh(),
    useHouseholdCategories().refresh(),
    useHouseholdObjects().refresh(),
    reloadObjectChildren(),
    useSettings().refresh(),
  ])
}

/** Replaces the database with the backup, then reloads every list. */
async function restoreBackup(backup: BackupInfo): Promise<void> {
  try {
    await dataTransfer.restoreBackup(backup.path)
  } finally {
    await reloadAllData()
  }
}

/** Exports all data as JSON. Returns the chosen path. */
async function exportJson(): Promise<string | null> {
  const destination = await dataTransfer.pickJsonExportDestination()
  if (!destination) return null
  await dataTransfer.exportJson(destination)
  return destination
}

/** Exports one CSV file per table. Returns the folder that was created. */
async function exportCsv(): Promise<string | null> {
  const directory = await dataTransfer.pickCsvExportFolder()
  return directory ? dataTransfer.exportCsv(directory) : null
}

/** Lets the user pick a JSON export and validates it. Nothing is changed yet. */
async function chooseExport(): Promise<ExportInfo | null> {
  const source = await dataTransfer.pickJsonImportSource()
  return source ? dataTransfer.inspectExport(source) : null
}

/** Replaces all data with the export, then reloads every list. */
async function importExport(exported: ExportInfo): Promise<void> {
  try {
    await dataTransfer.importJson(exported.path)
  } finally {
    await reloadAllData()
  }
}

export interface UseDataTransfer {
  createBackup: () => Promise<string | null>
  chooseBackup: () => Promise<BackupInfo | null>
  restoreBackup: (backup: BackupInfo) => Promise<void>
  exportJson: () => Promise<string | null>
  exportCsv: () => Promise<string | null>
  chooseExport: () => Promise<ExportInfo | null>
  importExport: (exported: ExportInfo) => Promise<void>
}

export function useDataTransfer(): UseDataTransfer {
  return { createBackup, chooseBackup, restoreBackup, exportJson, exportCsv, chooseExport, importExport }
}
