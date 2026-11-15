//! Backup, restore, export and import of the application database.
//!
//! * **Backup** – `VACUUM INTO` a consistent snapshot of the live database.
//! * **Restore** – validate a backup file, close the live pool, swap the files and
//!   reopen the database (migrating older backups) in place. No restart needed.
//! * **Export / import** – all user tables as one JSON document (importable),
//!   or one CSV file per table (for spreadsheets, export only). Import replaces
//!   all data in a single transaction.
//!
//! Every command takes a path the user picked in a native file dialog.

use std::fs;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;

use serde_json::{json, Map, Value};
use sqlx::sqlite::{SqliteConnectOptions, SqliteRow};
use sqlx::{ConnectOptions, Connection, Row, Sqlite, SqliteConnection, TypeInfo, ValueRef};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::{migrations, DATABASE_URL};

/// Identifies JSON exports written by HomeBase.
const EXPORT_FORMAT: &str = "homebase-export";
/// Version of the JSON envelope (not of the database schema).
const EXPORT_FORMAT_VERSION: i64 = 1;
/// sqlx's bookkeeping table. Never exported or imported.
const MIGRATIONS_TABLE: &str = "_sqlx_migrations";

type CommandResult<T> = Result<T, String>;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/// File name of the live database (`homebase.db`), derived from `DATABASE_URL`.
fn database_file_name() -> &'static str {
    DATABASE_URL.trim_start_matches("sqlite:")
}

fn config_dir<R: Runtime>(app: &AppHandle<R>) -> CommandResult<PathBuf> {
    app.path()
        .app_config_dir()
        .map_err(|error| format!("App data folder not found: {error}"))
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
async fn live_pool<R: Runtime>(app: &AppHandle<R>) -> CommandResult<sqlx::Pool<Sqlite>> {
    let instances = app.state::<DbInstances>();
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

/// Feeds [`app_migrations`] to `sqlx::migrate::Migrator` when a restored database is reopened.
#[derive(Debug)]
struct AppMigrations;

impl sqlx::migrate::MigrationSource<'static> for AppMigrations {
    fn resolve(
        self,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<sqlx::migrate::Migration>, sqlx::error::BoxDynError>> + Send>> {
        Box::pin(async { Ok(app_migrations()) })
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
    .map_err(|e| e.to_string())
}

async fn table_columns(conn: &mut SqliteConnection, table: &str) -> CommandResult<Vec<String>> {
    let rows = sqlx::query(&format!("PRAGMA table_info({})", quote_identifier(table)))
        .fetch_all(conn)
        .await
        .map_err(|e| e.to_string())?;
    rows.iter()
        .map(|row| row.try_get::<String, _>("name").map_err(|e| e.to_string()))
        .collect()
}

async fn row_counts(conn: &mut SqliteConnection) -> CommandResult<Vec<Value>> {
    let mut counts = Vec::new();
    for table in user_tables(conn).await? {
        let rows: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {}", quote_identifier(&table)))
            .fetch_one(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;
        counts.push(json!({ "name": table, "rows": rows }));
    }
    Ok(counts)
}

async fn now_utc(conn: &mut SqliteConnection) -> CommandResult<String> {
    sqlx::query_scalar("SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
        .fetch_one(conn)
        .await
        .map_err(|e| e.to_string())
}

/// Converts one SQLite value into JSON, keeping its storage class.
fn column_to_json(row: &SqliteRow, index: usize) -> CommandResult<Value> {
    let raw = row.try_get_raw(index).map_err(|e| e.to_string())?;
    if raw.is_null() {
        return Ok(Value::Null);
    }
    let type_name = raw.type_info().name().to_string();
    let value = match type_name.as_str() {
        "INTEGER" => Value::from(row.try_get_unchecked::<i64, _>(index).map_err(|e| e.to_string())?),
        "REAL" => Value::from(row.try_get_unchecked::<f64, _>(index).map_err(|e| e.to_string())?),
        "TEXT" => Value::from(row.try_get_unchecked::<String, _>(index).map_err(|e| e.to_string())?),
        other => return Err(format!("Column type {other} cannot be exported.")),
    };
    Ok(value)
}

/// Reads every row of every user table. Call inside a transaction for a consistent snapshot.
async fn read_all_tables(conn: &mut SqliteConnection) -> CommandResult<Vec<(String, Vec<String>, Vec<Vec<Value>>)>> {
    let mut tables = Vec::new();
    for table in user_tables(conn).await? {
        let columns = table_columns(conn, &table).await?;
        let column_list = columns.iter().map(|c| quote_identifier(c)).collect::<Vec<_>>().join(", ");
        // Ordered by rowid so exports are stable and IDs stay ascending.
        let rows = sqlx::query(&format!("SELECT {column_list} FROM {} ORDER BY rowid", quote_identifier(&table)))
            .fetch_all(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;
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

/// Checks that `path` is an intact HomeBase database this app can migrate,
/// and returns its schema version and row counts.
async fn inspect_database_file(path: &Path) -> CommandResult<Value> {
    if !path.is_file() {
        return Err(format!("File not found: {}", path.display()));
    }
    let not_a_backup = || "This file is not a HomeBase backup.".to_string();

    let mut conn = SqliteConnectOptions::new()
        .filename(path)
        .read_only(true)
        .create_if_missing(false)
        .connect()
        .await
        .map_err(|_| not_a_backup())?;

    let result = async {
        let check: String = sqlx::query_scalar("PRAGMA quick_check")
            .fetch_one(&mut conn)
            .await
            .map_err(|_| not_a_backup())?;
        if check != "ok" {
            return Err(format!("The backup is damaged: {check}"));
        }

        let has_migrations: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = $1")
                .bind(MIGRATIONS_TABLE)
                .fetch_one(&mut conn)
                .await
                .map_err(|e| e.to_string())?;
        if has_migrations == 0 {
            return Err(not_a_backup());
        }

        let applied: Vec<(i64, Vec<u8>, bool)> = sqlx::query_as(&format!(
            "SELECT version, checksum, success FROM {MIGRATIONS_TABLE} ORDER BY version"
        ))
        .fetch_all(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

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
        let schema_version = applied.last().map(|(v, _, _)| *v).ok_or_else(not_a_backup)?;

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

/// Saves a consistent snapshot of the live database to `destination`.
#[tauri::command]
pub async fn create_backup<R: Runtime>(app: AppHandle<R>, destination: String) -> CommandResult<()> {
    let destination = PathBuf::from(destination);
    if is_same_file(&destination, &live_database_path(&config_dir(&app)?)) {
        return Err("Choose a different file: this is the live database.".into());
    }
    let pool = live_pool(&app).await?;
    vacuum_into(&pool, &destination).await?;
    log::info!("Backup created: {}", destination.display());
    Ok(())
}

/// Validates a backup and returns what it contains, without changing anything.
#[tauri::command]
pub async fn inspect_backup(source: String) -> CommandResult<Value> {
    inspect_database_file(Path::new(&source)).await
}

/// Moves the database at `from` and its side files (`-wal`, `-shm`, `-journal`)
/// to `to`, replacing whatever is there.
fn move_database_files(from: &Path, to: &Path) -> CommandResult<()> {
    for suffix in ["", "-wal", "-shm", "-journal"] {
        let target = with_suffix(to, suffix);
        if target.exists() {
            fs::remove_file(&target).map_err(|e| format!("{}: {e}", target.display()))?;
        }
        let source = with_suffix(from, suffix);
        if source.exists() {
            fs::rename(&source, &target).map_err(|e| format!("{}: {e}", source.display()))?;
        }
    }
    Ok(())
}

/// Opens the database like the SQL plugin does and applies pending migrations.
async fn open_and_migrate(path: &Path) -> CommandResult<sqlx::Pool<Sqlite>> {
    let options = SqliteConnectOptions::new().filename(path).create_if_missing(true);
    let pool = sqlx::SqlitePool::connect_with(options)
        .await
        .map_err(|e| format!("Could not open the database: {e}"))?;
    let migrated = async {
        let migrator = sqlx::migrate::Migrator::new(AppMigrations)
            .await
            .map_err(|e| e.to_string())?;
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

/// Replaces the live database with a validated copy of `source`, without restarting.
///
/// The SQL plugin's commands take a read lock on [`DbInstances`]; holding the
/// write lock makes them wait until the new pool is in place. The previous
/// database is kept as `homebase.before-restore.db`.
#[tauri::command]
pub async fn restore_backup<R: Runtime>(app: AppHandle<R>, source: String) -> CommandResult<()> {
    let source = PathBuf::from(source);
    inspect_database_file(&source).await?;

    let dir = config_dir(&app)?;
    let live = live_database_path(&dir);
    let staged = staged_restore_path(&dir);
    let previous = before_restore_path(&dir);
    if is_same_file(&source, &live) {
        return Err("This is the live database, there is nothing to restore.".into());
    }

    // Copy first: if this fails, the live database is untouched.
    let mut conn = SqliteConnectOptions::new()
        .filename(&source)
        .read_only(true)
        .connect()
        .await
        .map_err(|e| e.to_string())?;
    let copied = vacuum_into(&mut conn, &staged).await;
    let _ = conn.close().await;
    copied?;

    let instances = app.state::<DbInstances>();
    let mut instances = instances.0.write().await;
    if let Some(DbPool::Sqlite(pool)) = instances.get(DATABASE_URL) {
        // Waits until every connection is returned and closed, so the files can be moved.
        pool.close().await;
    }

    let swapped = async {
        move_database_files(&live, &previous)?;
        fs::rename(&staged, &live).map_err(|e| format!("Could not restore the backup: {e}"))?;
        open_and_migrate(&live).await
    }
    .await;

    let pool = match swapped {
        Ok(pool) => pool,
        Err(error) => {
            log::error!("Restore from {} failed, rolling back: {error}", source.display());
            // Put the previous database back and reopen it.
            let _ = fs::remove_file(&staged);
            let rolled_back = async {
                move_database_files(&previous, &live)?;
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
    log::info!(
        "Backup restored from {} (previous database kept as {})",
        source.display(),
        previous.display()
    );
    Ok(())
}

// ---------------------------------------------------------------------------
// Export & import
// ---------------------------------------------------------------------------

/// Writes all user data as one JSON document that [`import_json`] can read back.
#[tauri::command]
pub async fn export_json<R: Runtime>(app: AppHandle<R>, destination: String) -> CommandResult<()> {
    let pool = live_pool(&app).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let exported_at = now_utc(&mut tx).await?;
    let tables = read_all_tables(&mut tx).await?;
    tx.rollback().await.map_err(|e| e.to_string())?;

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
    let text = serde_json::to_string_pretty(&document).map_err(|e| e.to_string())?;
    fs::write(&destination, text).map_err(|e| format!("Could not write {destination}: {e}"))?;
    log::info!("JSON export written: {destination}");
    Ok(())
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
#[tauri::command]
pub async fn export_csv<R: Runtime>(app: AppHandle<R>, directory: String) -> CommandResult<String> {
    let pool = live_pool(&app).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let stamp: String = sqlx::query_scalar("SELECT strftime('%Y-%m-%d_%H%M%S', 'now', 'localtime')")
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    let tables = read_all_tables(&mut tx).await?;
    tx.rollback().await.map_err(|e| e.to_string())?;

    let folder = Path::new(&directory).join(format!("homebase-export-{stamp}"));
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
        fs::write(&file, text).map_err(|e| format!("Could not write {}: {e}", file.display()))?;
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
#[tauri::command]
pub async fn inspect_export(source: String) -> CommandResult<Value> {
    let (schema_version, exported_at, tables) = parse_export(&read_export_file(&source)?)?;
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
            None => query.bind(number.as_f64().ok_or_else(|| format!("Invalid number in {location}."))?),
        },
        Value::String(text) => query.bind(text.clone()),
        _ => return Err(format!("Unsupported value in {location}.")),
    })
}

/// Replaces **all** data with the contents of a JSON export, in one transaction.
/// A snapshot of the previous data is kept as `homebase.before-import.db`.
#[tauri::command]
pub async fn import_json<R: Runtime>(app: AppHandle<R>, source: String) -> CommandResult<()> {
    let (_, _, tables) = parse_export(&read_export_file(&source)?)?;
    let pool = live_pool(&app).await?;
    vacuum_into(&pool, &before_import_path(&config_dir(&app)?)).await?;

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    // Foreign keys are checked at COMMIT, so tables can be filled in any order.
    sqlx::query("PRAGMA defer_foreign_keys = ON")
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    let live_tables = user_tables(&mut tx).await?;
    if let Some(unknown) = tables.keys().find(|name| !live_tables.contains(name)) {
        return Err(format!("The export contains an unknown table: {unknown}"));
    }

    // Replace, not merge: tables missing from the export end up empty.
    for table in &live_tables {
        sqlx::query(&format!("DELETE FROM {}", quote_identifier(table)))
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
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
