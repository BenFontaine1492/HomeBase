import Database, { type QueryResult } from '@tauri-apps/plugin-sql'
import { DatabaseError } from './database-error'

/**
 * Connection string of the application database.
 *
 * The database is opened and migrated natively at startup (`plugins.sql.preload`
 * in `src-tauri/tauri.conf.json`). The frontend therefore only *attaches* to the
 * already open connection and is not permitted to open other database files
 * (the `sql:allow-load` permission is intentionally not granted).
 *
 * Must match `DATABASE_URL` in `src-tauri/src/lib.rs`.
 */
export const DATABASE_URL = 'sqlite:homebase.db'

export type SqlValue = string | number | boolean | null

let connection: Database | null = null

/** Returns the single shared connection, creating the handle on first use. */
function getConnection(): Database {
  connection ??= Database.get(DATABASE_URL)
  return connection
}

/**
 * Runs a read query and returns typed rows.
 * Always use `$1, $2, …` placeholders – never interpolate values into SQL.
 */
export async function select<Row>(sql: string, params: readonly SqlValue[] = []): Promise<Row[]> {
  try {
    return await getConnection().select<Row[]>(sql, [...params])
  } catch (error) {
    throw new DatabaseError('select', error)
  }
}

/**
 * Runs a write query (INSERT / UPDATE / DELETE).
 * Always use `$1, $2, …` placeholders – never interpolate values into SQL.
 */
export async function execute(sql: string, params: readonly SqlValue[] = []): Promise<QueryResult> {
  try {
    return await getConnection().execute(sql, [...params])
  } catch (error) {
    throw new DatabaseError('execute', error)
  }
}
