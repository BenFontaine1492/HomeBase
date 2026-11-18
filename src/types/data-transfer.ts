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

/** Readable names for the tables, used in the restore/import summaries. */
export const TABLE_LABELS: Readonly<Record<string, string>> = {
  investments: 'Investments',
  household_categories: 'Inventory categories',
  household_objects: 'Inventory objects',
  household_object_attributes: 'Object attributes',
  maintenance_tasks: 'Maintenance tasks',
  maintenance_records: 'Maintenance history',
  attachments: 'Documents',
  settings: 'Settings',
}

export function tableLabel(name: string): string {
  return TABLE_LABELS[name] ?? name
}
