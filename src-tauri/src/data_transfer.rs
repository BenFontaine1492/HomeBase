//! Backup, restore, export and import of the application database.
//!
//! * **Backup** – `VACUUM INTO` a consistent snapshot of the live database.
//! * **Restore** – validate a backup file, close the live pool, swap the files and
//!   reopen the database (migrating older backups) in place. No restart needed.
//! * **Export / import** – all user tables as one JSON document (importable),
//!   or one CSV file per table (for spreadsheets, export only). Import replaces
//!   all data in a single transaction.
//!
//! Every path comes from a native file dialog. The Tauri commands in
//! `commands.rs` resolve the app data folder and the SQL plugin's open
//! databases ([`DbInstances`]) and call the functions here, so everything in
//! this module can be tested without a running app.

use std::fs;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;

use serde_json::{json, Map, Value};
use sqlx::sqlite::{SqliteConnectOptions, SqliteRow};
use sqlx::{ConnectOptions, Connection, Row, Sqlite, SqliteConnection, TypeInfo, ValueRef};
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::{migrations, DATABASE_URL};

/// Identifies JSON exports written by HomeBase.
const EXPORT_FORMAT: &str = "homebase-export";
/// Version of the JSON envelope (not of the database schema).
const EXPORT_FORMAT_VERSION: i64 = 1;
/// sqlx's bookkeeping table. Never exported or imported.
const MIGRATIONS_TABLE: &str = "_sqlx_migrations";

pub(crate) type CommandResult<T> = Result<T, String>;

/// Turns any error into the text the frontend shows.
///
/// Passed by name (`.map_err(error_text)`) instead of `.map_err(|e| e.to_string())`:
/// each closure counts as its own piece of code for the coverage gate, and most
/// database calls here can't be made to fail in a test.
fn error_text(error: impl std::fmt::Display) -> String {
    error.to_string()
}

/// The message for any file that turns out not to be a HomeBase database.
/// Takes (and ignores) the underlying error so it can be passed to `map_err`.
fn not_a_backup<E>(_error: E) -> String {
    "This file is not a HomeBase backup.".to_string()
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/// File name of the live database (`homebase.db`), derived from `DATABASE_URL`.
fn database_file_name() -> &'static str {
    DATABASE_URL.trim_start_matches("sqlite:")
}

fn live_database_path(dir: &Path) -> PathBuf {
    dir.join(database_file_name())
}

/// Temporary copy of the backup, swapped in once it is complete.
fn staged_restore_path(dir: &Path) -> PathBuf {
    dir.join(format!("{}.restore", database_file_name()))
}

/// The database as it was before the last restore.
fn before_restore_path(dir: &Path) -> PathBuf {
    dir.join("homebase.before-restore.db")
}

/// The database as it was before the last import.
fn before_import_path(dir: &Path) -> PathBuf {
    dir.join("homebase.before-import.db")
}

/// `path` with `suffix` appended to the file name (e.g. `homebase.db-wal`).
fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_owned();
    name.push(suffix);
    PathBuf::from(name)
}

fn path_to_str(path: &Path) -> CommandResult<&str> {
    path.to_str()
        .ok_or_else(|| format!("Unsupported characters in path: {}", path.display()))
}

fn is_same_file(a: &Path, b: &Path) -> bool {
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

/// The pool the SQL plugin opened at startup (shared with the frontend).
#[allow(unreachable_patterns)] // `_` only matters if another sql driver feature is enabled
async fn live_pool(instances: &DbInstances) -> CommandResult<sqlx::Pool<Sqlite>> {
    let instances = instances.0.read().await;
    // `DbPool::sqlite()` is commented out in tauri-plugin-sql 2.6, so match the variant.
    match instances.get(DATABASE_URL) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        _ => Err("The database is not open.".to_string()),
    }
}

/// The app's migrations as sqlx sees them (same conversion as tauri-plugin-sql,
/// so versions and checksums match what the plugin records).
fn app_migrations() -> Vec<sqlx::migrate::Migration> {
    migrations::all()
        .into_iter()
        .map(|m| {
            sqlx::migrate::Migration::new(
                m.version,
                m.description.into(),
                sqlx::migrate::MigrationType::ReversibleUp,
                m.sql.into(),
                false,
            )
        })
        .collect()
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

/// Highest migration version this build of the app knows.
pub(crate) fn app_schema_version() -> i64 {
    migrations::all().iter().map(|m| m.version).max().unwrap_or(0)
}

/// Quotes an SQL identifier (table or column name).
fn quote_identifier(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}

/// Writes a consistent copy of the database behind `executor` to `destination`.
///
/// `VACUUM INTO` refuses to overwrite files, so it writes to a temporary file
/// that then replaces the destination.
async fn vacuum_into<'e, E>(executor: E, destination: &Path) -> CommandResult<()>
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

async fn now_utc(conn: &mut SqliteConnection) -> CommandResult<String> {
    sqlx::query_scalar("SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
        .fetch_one(conn)
        .await
        .map_err(error_text)
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
type TableData = (String, Vec<String>, Vec<Vec<Value>>);

/// Reads every row of every user table. Call inside a transaction for a consistent snapshot.
async fn read_all_tables(conn: &mut SqliteConnection) -> CommandResult<Vec<TableData>> {
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

// ---------------------------------------------------------------------------
// Backup & restore
// ---------------------------------------------------------------------------

/// `PRAGMA quick_check` returns `ok` or a description of the damage.
fn ensure_intact(check: &str) -> CommandResult<()> {
    if check == "ok" {
        Ok(())
    } else {
        Err(format!("The backup is damaged: {check}"))
    }
}

/// Checks that `path` is an intact HomeBase database this app can migrate,
/// and returns its schema version and row counts. Changes nothing.
pub(crate) async fn inspect_backup(path: &Path) -> CommandResult<Value> {
    if !path.is_file() {
        return Err(format!("File not found: {}", path.display()));
    }

    let mut conn = SqliteConnectOptions::new()
        .filename(path)
        .read_only(true)
        .create_if_missing(false)
        .connect()
        .await
        .map_err(not_a_backup)?;

    let result = async {
        let check: String = sqlx::query_scalar("PRAGMA quick_check")
            .fetch_one(&mut conn)
            .await
            .map_err(not_a_backup)?;
        ensure_intact(&check)?;

        let has_migrations: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = $1")
                .bind(MIGRATIONS_TABLE)
                .fetch_one(&mut conn)
                .await
                .map_err(error_text)?;
        if has_migrations == 0 {
            return Err(not_a_backup(()));
        }

        let applied: Vec<(i64, Vec<u8>, bool)> = sqlx::query_as(&format!(
            "SELECT version, checksum, success FROM {MIGRATIONS_TABLE} ORDER BY version"
        ))
        .fetch_all(&mut conn)
        .await
        .map_err(error_text)?;

        let app_version = app_schema_version();
        let known = app_migrations();
        for (version, checksum, success) in &applied {
            if !success {
                return Err(format!("The backup contains an incomplete migration (version {version})."));
            }
            if *version > app_version {
                return Err(format!(
                    "The backup was created by a newer version of HomeBase (schema {version}, this app supports up to {app_version}). Update HomeBase first."
                ));
            }
            // sqlx refuses to open a database whose applied migrations have a
            // different checksum, so a mismatch would break the restored database.
            let expected = known.iter().find(|m| m.version == *version);
            if expected.map(|m| m.checksum.as_ref()) != Some(checksum.as_slice()) {
                return Err(format!("The backup's schema (migration {version}) does not match this version of HomeBase."));
            }
        }
        let schema_version = applied.last().map(|(v, _, _)| *v).ok_or_else(|| not_a_backup(()))?;

        Ok::<Value, String>(json!({
            "path": path.display().to_string(),
            "schemaVersion": schema_version,
            "appSchemaVersion": app_version,
            "tables": row_counts(&mut conn).await?,
        }))
    }
    .await;

    let _ = conn.close().await;
    result
}

/// Saves a consistent snapshot of the live database (in `dir`) to `destination`.
pub(crate) async fn create_backup(dir: &Path, instances: &DbInstances, destination: &Path) -> CommandResult<()> {
    if is_same_file(destination, &live_database_path(dir)) {
        return Err("Choose a different file: this is the live database.".into());
    }
    let pool = live_pool(instances).await?;
    vacuum_into(&pool, destination).await?;
    log::info!("Backup created: {}", destination.display());
    Ok(())
}

/// Moves the database at `from` and its side files (`-wal`, `-shm`, `-journal`)
/// to `to`, replacing whatever is there.
fn move_database_files(from: &Path, to: &Path) -> CommandResult<()> {
    for suffix in ["", "-wal", "-shm", "-journal"] {
        let target = with_suffix(to, suffix);
        if target.exists() {
            fs::remove_file(&target).map_err(|e| format!("Could not replace {}: {e}", target.display()))?;
        }
        let source = with_suffix(from, suffix);
        if source.exists() {
            fs::rename(&source, &target)
                .map_err(|e| format!("Could not move {} to {}: {e}", source.display(), target.display()))?;
        }
    }
    Ok(())
}

/// Opens the database like the SQL plugin does and applies `migrations`.
async fn open_with_migrations(
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
async fn open_and_migrate(path: &Path) -> CommandResult<sqlx::Pool<Sqlite>> {
    open_with_migrations(path, app_migrations()).await
}

/// Replaces the live database (in `dir`) with a validated copy of `source`,
/// without restarting.
///
/// The SQL plugin's commands take a read lock on [`DbInstances`]; holding the
/// write lock makes them wait until the new pool is in place. The previous
/// database is kept as `homebase.before-restore.db`.
pub(crate) async fn restore_backup(dir: &Path, instances: &DbInstances, source: &Path) -> CommandResult<()> {
    inspect_backup(source).await?;

    let live = live_database_path(dir);
    let staged = staged_restore_path(dir);
    let previous = before_restore_path(dir);
    if is_same_file(source, &live) {
        return Err("This is the live database, there is nothing to restore.".into());
    }

    // Copy first: if this fails, the live database is untouched.
    let mut conn = SqliteConnectOptions::new()
        .filename(source)
        .read_only(true)
        .connect()
        .await
        .map_err(error_text)?;
    let copied = vacuum_into(&mut conn, &staged).await;
    let _ = conn.close().await;
    copied?;

    let mut instances = instances.0.write().await;
    if let Some(DbPool::Sqlite(pool)) = instances.get(DATABASE_URL) {
        // Waits until every connection is returned and closed, so the files can be moved.
        pool.close().await;
    }

    // Set once the backup has taken the live database's place.
    let mut swapped_in = false;
    let swapped = async {
        move_database_files(&live, &previous)?;
        move_database_files(&staged, &live)?;
        swapped_in = true;
        open_and_migrate(&live).await
    }
    .await;

    let pool = match swapped {
        Ok(pool) => pool,
        Err(error) => {
            log::error!("Restore from {} failed, rolling back: {error}", source.display());
            let _ = fs::remove_file(&staged);
            let rolled_back = async {
                // Put the previous database back, unless it never left its place
                // (moving it away failed before anything was moved).
                if swapped_in || !live.exists() {
                    move_database_files(&previous, &live)?;
                }
                open_and_migrate(&live).await
            }
            .await;
            return match rolled_back {
                Ok(pool) => {
                    instances.insert(DATABASE_URL.to_string(), DbPool::Sqlite(pool));
                    log::info!("Rollback succeeded, the previous database is open again");
                    Err(format!("{error} Your data was not changed."))
                }
                Err(rollback_error) => {
                    log::error!("Rollback failed, no database is open: {rollback_error}");
                    Err(format!(
                        "{error} Reopening the previous database also failed ({rollback_error}). Restart HomeBase."
                    ))
                }
            };
        }
    };
    instances.insert(DATABASE_URL.to_string(), DbPool::Sqlite(pool));
    // On one line: the arguments only run while a logger is active (not in tests).
    log::info!("Backup restored from {} (previous database kept as {})", source.display(), previous.display());
    Ok(())
}

// ---------------------------------------------------------------------------
// Export & import
// ---------------------------------------------------------------------------

/// Writes all user data as one JSON document that [`import_json`] can read back.
pub(crate) async fn export_json(instances: &DbInstances, destination: &Path) -> CommandResult<()> {
    let pool = live_pool(instances).await?;
    let mut tx = pool.begin().await.map_err(error_text)?;
    let exported_at = now_utc(&mut tx).await?;
    let tables = read_all_tables(&mut tx).await?;
    tx.rollback().await.map_err(error_text)?;

    let mut table_map = Map::new();
    for (name, columns, rows) in tables {
        let rows = rows
            .into_iter()
            .map(|values| Value::Object(columns.iter().cloned().zip(values).collect()))
            .collect();
        table_map.insert(name, Value::Array(rows));
    }
    let document = json!({
        "format": EXPORT_FORMAT,
        "formatVersion": EXPORT_FORMAT_VERSION,
        "schemaVersion": app_schema_version(),
        "exportedAt": exported_at,
        "tables": table_map,
    });
    let text = serde_json::to_string_pretty(&document).map_err(error_text)?;
    write_file(destination, &text)?;
    log::info!("JSON export written: {}", destination.display());
    Ok(())
}

/// Writes an export file. Shared by the JSON and CSV exports.
fn write_file(path: &Path, text: &str) -> CommandResult<()> {
    fs::write(path, text).map_err(|e| format!("Could not write {}: {e}", path.display()))
}

fn csv_field(value: &Value) -> String {
    let text = match value {
        Value::Null => return String::new(),
        Value::String(text) => text.clone(),
        other => other.to_string(),
    };
    if text.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", text.replace('"', "\"\""))
    } else {
        text
    }
}

/// Writes one CSV file per table into a new folder inside `directory`.
/// Returns the path of that folder.
pub(crate) async fn export_csv(instances: &DbInstances, directory: &Path) -> CommandResult<String> {
    let pool = live_pool(instances).await?;
    let mut tx = pool.begin().await.map_err(error_text)?;
    let stamp: String = sqlx::query_scalar("SELECT strftime('%Y-%m-%d_%H%M%S', 'now', 'localtime')")
        .fetch_one(&mut *tx)
        .await
        .map_err(error_text)?;
    let tables = read_all_tables(&mut tx).await?;
    tx.rollback().await.map_err(error_text)?;

    let folder = directory.join(format!("homebase-export-{stamp}"));
    fs::create_dir_all(&folder).map_err(|e| format!("Could not create {}: {e}", folder.display()))?;
    for (name, columns, rows) in tables {
        // UTF-8 BOM so Excel detects the encoding (umlauts, €).
        let mut text = String::from("\u{feff}");
        text.push_str(&columns.iter().map(|c| csv_field(&Value::from(c.as_str()))).collect::<Vec<_>>().join(","));
        text.push_str("\r\n");
        for values in rows {
            text.push_str(&values.iter().map(csv_field).collect::<Vec<_>>().join(","));
            text.push_str("\r\n");
        }
        let file = folder.join(format!("{name}.csv"));
        write_file(&file, &text)?;
    }
    log::info!("CSV export written: {}", folder.display());
    Ok(folder.display().to_string())
}

/// Parses and checks a JSON export; returns the document's `tables` object.
fn parse_export(text: &str) -> CommandResult<(i64, String, Map<String, Value>)> {
    let invalid = || "This file is not a HomeBase export.".to_string();
    let document: Value = serde_json::from_str(text).map_err(|_| invalid())?;
    if document.get("format").and_then(Value::as_str) != Some(EXPORT_FORMAT) {
        return Err(invalid());
    }
    if document.get("formatVersion").and_then(Value::as_i64) != Some(EXPORT_FORMAT_VERSION) {
        return Err("This export uses an unsupported format version.".into());
    }
    let schema_version = document.get("schemaVersion").and_then(Value::as_i64).ok_or_else(invalid)?;
    let app_version = app_schema_version();
    if schema_version > app_version {
        return Err(format!(
            "The export was created by a newer version of HomeBase (schema {schema_version}, this app supports up to {app_version}). Update HomeBase first."
        ));
    }
    let exported_at = document.get("exportedAt").and_then(Value::as_str).unwrap_or_default().to_string();
    let tables = document.get("tables").and_then(Value::as_object).cloned().ok_or_else(invalid)?;
    for (name, rows) in &tables {
        let rows = rows.as_array().ok_or_else(invalid)?;
        if rows.iter().any(|row| !row.is_object()) {
            return Err(format!("Table {name} in the export is malformed."));
        }
    }
    Ok((schema_version, exported_at, tables))
}

fn read_export_file(path: &str) -> CommandResult<String> {
    fs::read_to_string(path).map_err(|e| format!("Could not read {path}: {e}"))
}

/// Validates a JSON export and returns what it contains, without changing anything.
pub(crate) fn inspect_export(source: &str) -> CommandResult<Value> {
    let (schema_version, exported_at, tables) = parse_export(&read_export_file(source)?)?;
    let counts: Vec<Value> = tables
        .iter()
        .map(|(name, rows)| json!({ "name": name, "rows": rows.as_array().map_or(0, Vec::len) }))
        .collect();
    Ok(json!({
        "path": source,
        "schemaVersion": schema_version,
        "appSchemaVersion": app_schema_version(),
        "exportedAt": exported_at,
        "tables": counts,
    }))
}

fn bind_json<'q>(
    query: sqlx::query::Query<'q, Sqlite, sqlx::sqlite::SqliteArguments<'q>>,
    value: &Value,
    location: &str,
) -> CommandResult<sqlx::query::Query<'q, Sqlite, sqlx::sqlite::SqliteArguments<'q>>> {
    Ok(match value {
        Value::Null => query.bind(None::<i64>),
        Value::Bool(flag) => query.bind(i64::from(*flag)),
        Value::Number(number) => match number.as_i64() {
            Some(integer) => query.bind(integer),
            // Not an i64, so a float: as_f64() is always Some without serde_json's
            // `arbitrary_precision` feature (which this app doesn't enable).
            None => query.bind(number.as_f64()),
        },
        Value::String(text) => query.bind(text.clone()),
        _ => return Err(format!("Unsupported value in {location}.")),
    })
}

/// Replaces **all** data with the contents of a JSON export, in one transaction.
/// A snapshot of the previous data is kept as `homebase.before-import.db` in `dir`.
pub(crate) async fn import_json(dir: &Path, instances: &DbInstances, source: &str) -> CommandResult<()> {
    let (_, _, tables) = parse_export(&read_export_file(source)?)?;
    let pool = live_pool(instances).await?;
    vacuum_into(&pool, &before_import_path(dir)).await?;

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

    for (table, rows) in &tables {
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

    // Dropping `tx` on an error above rolls everything back.
    tx.commit()
        .await
        .map_err(|e| format!("The export is inconsistent and was not imported: {e}"))?;
    log::info!("JSON export imported: {source}");
    Ok(())
}

#[cfg(test)]
#[path = "data_transfer_tests.rs"]
mod tests;
