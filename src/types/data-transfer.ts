import { t } from '@/i18n'
import { en, type Messages } from '@/i18n/messages/en'

/** Number of rows in one table of a backup or export. */
export interface TableRowCount {
  /** SQLite table name, e.g. `household_objects`. */
  name: string
  rows: number
}

/** A validated backup file (see `inspect_backup` in `src-tauri/src/data_transfer/`). */
export interface BackupInfo {
  path: string
  /** Latest migration applied to the backup. */
  schemaVersion: number
  /** Latest migration this app knows. Older backups are migrated after restoring. */
  appSchemaVersion: number
  tables: TableRowCount[]
}

/** A validated JSON export (see `inspect_export`). */
export interface ExportInfo extends BackupInfo {
  /** ISO timestamp (UTC). Empty if the file doesn't say. */
  exportedAt: string
}

/** The tables with a readable name (restore/import summaries); others show their table name. */
type KnownTable = keyof Messages['settings']['data']['tables']

function isKnownTable(name: string): name is KnownTable {
  return Object.hasOwn(en.settings.data.tables, name)
}

export function tableLabel(name: string): string {
  return isKnownTable(name) ? t(`settings.data.tables.${name}`) : name
}
