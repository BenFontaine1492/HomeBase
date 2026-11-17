import { invoke } from '@tauri-apps/api/core'
import Database, { type QueryResult } from '@tauri-apps/plugin-sql'
import { DatabaseError } from './database-error'
import { logError } from './log'

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
export type { QueryResult }

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
    throw failed('select', sql, error)
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
    throw failed('execute', sql, error)
  }
}

/** One statement of a {@link transaction}. */
export interface SqlStatement {
  sql: string
  params: readonly SqlValue[]
}

/**
 * Runs several write statements in **one transaction**: all of them are
 * written, or none. Returns one result per statement.
 *
 * Needed because the SQL plugin sends each `execute()` to any free connection
 * of its pool, so `BEGIN … COMMIT` across separate calls is not reliable. The
 * batch runs natively (`src-tauri/src/db.rs`).
 * Always use `$1, $2, …` placeholders – never interpolate values into SQL.
 */
export async function transaction(statements: readonly SqlStatement[]): Promise<QueryResult[]> {
  try {
    return await invoke<QueryResult[]>('execute_transaction', {
      statements: statements.map(({ sql, params }) => [sql, [...params]]),
    })
  } catch (error) {
    throw failed('transaction', statements.map(({ sql }) => sql).join('; '), error)
  }
}

/** Logs the failure (SQL text only, never the parameter values) and wraps it. */
function failed(operation: string, sql: string, cause: unknown): DatabaseError {
  const databaseError = new DatabaseError(operation, cause)
  logError(`${databaseError.message} [SQL: ${sql.replace(/\s+/g, ' ').trim()}]`)
  return databaseError
}
