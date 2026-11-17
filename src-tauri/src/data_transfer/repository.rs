//! SQL of the data transfer service (repository layer): snapshots with
//! `VACUUM INTO`, reading all user tables, checking backup files, opening and
//! migrating a database, and replacing all data. No validation of user input
//! and no moving of database files (both in `mod.rs`).

use std::fs;
use std::future::Future;
use std::path::Path;
use std::pin::Pin;

use serde_json::{json, Map, Value};
use sqlx::sqlite::{SqliteConnectOptions, SqliteRow};
use sqlx::{ConnectOptions, Connection, Row, Sqlite, SqliteConnection, TypeInfo, ValueRef};

use super::paths::{path_to_str, with_suffix};
use crate::db::bind_json;
use crate::error::{error_text, CommandResult};
use crate::migrations::app_migrations;

/// sqlx's bookkeeping table. Never exported or imported.
const MIGRATIONS_TABLE: &str = "_sqlx_migrations";

/// Quotes an SQL identifier (table or column name).
pub(super) fn quote_identifier(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}

/// Feeds a list of migrations to `sqlx::migrate::Migrator` when a restored database is reopened.
#[derive(Debug)]
struct MigrationList(Vec<sqlx::migrate::Migration>);

impl sqlx::migrate::MigrationSource<'static> for MigrationList {
    fn resolve(
        self,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<sqlx::migrate::Migration>, sqlx::error::BoxDynError>> + Send>> {
        Box::pin(async move { Ok(self.0) })
    }
}

// ---------------------------------------------------------------------------
// Snapshots and reading
// ---------------------------------------------------------------------------

/// Writes a consistent copy of the database behind `executor` to `destination`.
///
/// `VACUUM INTO` refuses to overwrite files, so it writes to a temporary file
/// that then replaces the destination.
pub(super) async fn vacuum_into<'e, E>(executor: E, destination: &Path) -> CommandResult<()>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let temporary = with_suffix(destination, ".tmp");
    if temporary.exists() {
        fs::remove_file(&temporary).map_err(|e| format!("Could not replace {}: {e}", temporary.display()))?;
    }
    sqlx::query("VACUUM INTO $1")
        .bind(path_to_str(&temporary)?)
        .execute(executor)
        .await
        .map_err(|e| format!("Could not write the backup: {e}"))?;
    fs::rename(&temporary, destination).map_err(|e| {
        let _ = fs::remove_file(&temporary);
        format!("Could not save {}: {e}", destination.display())
    })
}

/// User tables, i.e. everything except SQLite internals and the migrations table.
async fn user_tables(conn: &mut SqliteConnection) -> CommandResult<Vec<String>> {
    sqlx::query_scalar(
        "SELECT name FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name <> $1
         ORDER BY name",
    )
    .bind(MIGRATIONS_TABLE)
    .fetch_all(conn)
    .await
    .map_err(error_text)
}

async fn table_columns(conn: &mut SqliteConnection, table: &str) -> CommandResult<Vec<String>> {
    let rows = sqlx::query(&format!("PRAGMA table_info({})", quote_identifier(table)))
        .fetch_all(conn)
        .await
        .map_err(error_text)?;
    rows.iter()
        .map(|row| row.try_get::<String, _>("name").map_err(error_text))
        .collect()
}

async fn row_counts(conn: &mut SqliteConnection) -> CommandResult<Vec<Value>> {
    let mut counts = Vec::new();
    for table in user_tables(conn).await? {
        let rows: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {}", quote_identifier(&table)))
            .fetch_one(&mut *conn)
            .await
            .map_err(error_text)?;
        counts.push(json!({ "name": table, "rows": rows }));
    }
    Ok(counts)
}

/// Converts one SQLite value into JSON, keeping its storage class.
fn column_to_json(row: &SqliteRow, index: usize) -> CommandResult<Value> {
    let raw = row.try_get_raw(index).map_err(error_text)?;
    if raw.is_null() {
        return Ok(Value::Null);
    }
    let type_name = raw.type_info().name().to_string();
    let value = match type_name.as_str() {
        "INTEGER" => Value::from(row.try_get_unchecked::<i64, _>(index).map_err(error_text)?),
        "REAL" => Value::from(row.try_get_unchecked::<f64, _>(index).map_err(error_text)?),
        "TEXT" => Value::from(row.try_get_unchecked::<String, _>(index).map_err(error_text)?),
        other => return Err(format!("Column type {other} cannot be exported.")),
    };
    Ok(value)
}

/// One user table: name, column names and all rows (values in column order).
pub(super) type TableData = (String, Vec<String>, Vec<Vec<Value>>);

/// Reads every row of every user table. Call inside a transaction for a consistent snapshot.
pub(super) async fn read_all_tables(conn: &mut SqliteConnection) -> CommandResult<Vec<TableData>> {
    let mut tables = Vec::new();
    for table in user_tables(conn).await? {
        let columns = table_columns(conn, &table).await?;
        let column_list = columns.iter().map(|c| quote_identifier(c)).collect::<Vec<_>>().join(", ");
        // Ordered by rowid so exports are stable and IDs stay ascending.
        let rows = sqlx::query(&format!("SELECT {column_list} FROM {} ORDER BY rowid", quote_identifier(&table)))
            .fetch_all(&mut *conn)
            .await
            .map_err(error_text)?;
        let values = rows
            .iter()
            .map(|row| (0..row.columns().len()).map(|i| column_to_json(row, i)).collect::<CommandResult<Vec<Value>>>())
            .collect::<CommandResult<Vec<Vec<Value>>>>()?;
        tables.push((table, columns, values));
    }
    Ok(tables)
}

/// All user data, read in one transaction, and when it was read.
pub(super) struct Snapshot {
    /// UTC, e.g. `2026-11-17T19:40:08Z`.
    pub(super) exported_at: String,
    /// Local time for file names, e.g. `2026-11-17_204008`.
    pub(super) local_stamp: String,
    pub(super) tables: Vec<TableData>,
}

/// Reads every user table inside one transaction, so the data is consistent.
pub(super) async fn read_snapshot(pool: &sqlx::Pool<Sqlite>) -> CommandResult<Snapshot> {
    let mut tx = pool.begin().await.map_err(error_text)?;
    let (exported_at, local_stamp): (String, String) = sqlx::query_as(
        "SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%d_%H%M%S', 'now', 'localtime')",
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(error_text)?;
    let tables = read_all_tables(&mut tx).await?;
    tx.rollback().await.map_err(error_text)?;
    Ok(Snapshot { exported_at, local_stamp, tables })
}

// ---------------------------------------------------------------------------
// Database files (backups)
// ---------------------------------------------------------------------------

/// A migration recorded in a database: version, checksum, success.
pub(super) type AppliedMigration = (i64, Vec<u8>, bool);

/// A database file opened read-only, e.g. a backup that is checked or copied.
pub(super) struct DatabaseFile(SqliteConnection);

impl DatabaseFile {
    pub(super) async fn open_read_only(path: &Path) -> Result<Self, sqlx::Error> {
        SqliteConnectOptions::new()
            .filename(path)
            .read_only(true)
            .create_if_missing(false)
            .connect()
            .await
            .map(Self)
    }

    /// `PRAGMA quick_check`: `ok`, or a description of the damage.
    pub(super) async fn quick_check(&mut self) -> Result<String, sqlx::Error> {
        sqlx::query_scalar("PRAGMA quick_check").fetch_one(&mut self.0).await
    }

    /// Whether sqlx's migrations table exists, i.e. the file was created by HomeBase.
    pub(super) async fn has_migrations_table(&mut self) -> CommandResult<bool> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = $1")
            .bind(MIGRATIONS_TABLE)
            .fetch_one(&mut self.0)
            .await
            .map_err(error_text)?;
        Ok(count > 0)
    }

    /// The migrations recorded in the file, oldest first.
    pub(super) async fn applied_migrations(&mut self) -> CommandResult<Vec<AppliedMigration>> {
        sqlx::query_as(&format!("SELECT version, checksum, success FROM {MIGRATIONS_TABLE} ORDER BY version"))
            .fetch_all(&mut self.0)
            .await
            .map_err(error_text)
    }

    pub(super) async fn row_counts(&mut self) -> CommandResult<Vec<Value>> {
        row_counts(&mut self.0).await
    }

    /// Writes a consistent copy of this database to `destination`.
    pub(super) async fn copy_to(&mut self, destination: &Path) -> CommandResult<()> {
        vacuum_into(&mut self.0, destination).await
    }

    pub(super) async fn close(self) {
        let _ = self.0.close().await;
    }
}

/// Opens the database like the SQL plugin does and applies `migrations`.
pub(super) async fn open_with_migrations(
    path: &Path,
    migrations: Vec<sqlx::migrate::Migration>,
) -> CommandResult<sqlx::Pool<Sqlite>> {
    let options = SqliteConnectOptions::new().filename(path).create_if_missing(true);
    let pool = sqlx::SqlitePool::connect_with(options)
        .await
        .map_err(|e| format!("Could not open the database: {e}"))?;
    let migrated = async {
        let migrator = sqlx::migrate::Migrator::new(MigrationList(migrations))
            .await
            .map_err(error_text)?;
        migrator
            .run(&pool)
            .await
            .map_err(|e| format!("Could not update the database: {e}"))
    }
    .await;
    if let Err(error) = migrated {
        pool.close().await;
        return Err(error);
    }
    Ok(pool)
}

/// Opens the database like the SQL plugin does and applies pending migrations.
pub(super) async fn open_and_migrate(path: &Path) -> CommandResult<sqlx::Pool<Sqlite>> {
    open_with_migrations(path, app_migrations()).await
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/// Replaces **all** user data with `tables` (table name → array of row objects),
/// in one transaction. Tables missing from `tables` end up empty. Unknown tables
/// or columns, and data that breaks a constraint, roll everything back.
pub(super) async fn replace_all_data(pool: &sqlx::Pool<Sqlite>, tables: &Map<String, Value>) -> CommandResult<()> {
    let mut tx = pool.begin().await.map_err(error_text)?;
    // Foreign keys are checked at COMMIT, so tables can be filled in any order.
    sqlx::query("PRAGMA defer_foreign_keys = ON")
        .execute(&mut *tx)
        .await
        .map_err(error_text)?;

    let live_tables = user_tables(&mut tx).await?;
    if let Some(unknown) = tables.keys().find(|name| !live_tables.contains(name)) {
        return Err(format!("The export contains an unknown table: {unknown}"));
    }

    // Replace, not merge: tables missing from the export end up empty.
    for table in &live_tables {
        sqlx::query(&format!("DELETE FROM {}", quote_identifier(table)))
            .execute(&mut *tx)
            .await
            .map_err(error_text)?;
    }

    for (table, rows) in tables {
        let columns = table_columns(&mut tx, table).await?;
        for (index, row) in rows.as_array().into_iter().flatten().enumerate() {
            let row = row.as_object().expect("validated in parse_export");
            if let Some(unknown) = row.keys().find(|key| !columns.contains(key)) {
                return Err(format!("Unknown column {unknown} in table {table}."));
            }
            let names: Vec<&String> = row.keys().collect();
            let sql = format!(
                "INSERT INTO {} ({}) VALUES ({})",
                quote_identifier(table),
                names.iter().map(|n| quote_identifier(n)).collect::<Vec<_>>().join(", "),
                (1..=names.len()).map(|i| format!("${i}")).collect::<Vec<_>>().join(", "),
            );
            let location = format!("{table}, row {}", index + 1);
            let mut query = sqlx::query(&sql);
            for value in row.values() {
                query = bind_json(query, value, &location)?;
            }
            query
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Could not import {location}: {e}"))?;
        }
    }

    // Returning early above drops `tx`, which rolls everything back.
    tx.commit()
        .await
        .map_err(|e| format!("The export is inconsistent and was not imported: {e}"))
}
