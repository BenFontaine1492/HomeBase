//! Backup, restore, export and import of the application database (service layer).
//!
//! * **Backup** – `VACUUM INTO` a consistent snapshot of the live database.
//! * **Restore** – validate a backup file, close the live pool, swap the files and
//!   reopen the database (migrating older backups) in place. No restart needed.
//! * **Export / import** – all user tables as one JSON document (importable),
//!   or one CSV file per table (for spreadsheets, export only). Import replaces
//!   all data in a single transaction.
//!
//! Layers: `commands.rs` (controllers) → this module (rules, file handling,
//! messages) → `repository.rs` (SQL) → `crate::db`. Every path comes from a
//! native file dialog. The commands resolve the app data folder and the SQL
//! plugin's open databases ([`DbInstances`]) and call the functions here, so
//! everything can be tested without a running app.

mod paths;
mod repository;
mod upgrade;

use std::fs;
use std::path::Path;

use serde_json::{json, Map, Value};
use tauri_plugin_sql::{DbInstances, DbPool};

use self::paths::{before_import_path, before_restore_path, is_same_file, live_database_path, staged_restore_path, with_suffix};
use self::repository::{open_and_migrate, read_snapshot, replace_all_data, vacuum_into, DatabaseFile};
use self::upgrade::upgrade_tables;
use crate::attachments::{set_aside_orphans, BEFORE_IMPORT_FOLDER, BEFORE_RESTORE_FOLDER};
use crate::db::live_pool;
use crate::error::{error_text, CommandResult};
use crate::migrations::{app_migrations, app_schema_version};
use crate::DATABASE_URL;

/// Identifies JSON exports written by HomeBase.
const EXPORT_FORMAT: &str = "homebase-export";
/// Version of the JSON envelope (not of the database schema).
const EXPORT_FORMAT_VERSION: i64 = 1;

/// The message for any file that turns out not to be a HomeBase database.
/// Takes (and ignores) the underlying error so it can be passed to `map_err`.
fn not_a_backup<E>(_error: E) -> String {
    "This file is not a HomeBase backup.".to_string()
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

/// The checks of [`inspect_backup`] on an opened file.
async fn check_backup(file: &mut DatabaseFile, path: &Path) -> CommandResult<Value> {
    let check = file.quick_check().await.map_err(not_a_backup)?;
    ensure_intact(&check)?;
    if !file.has_migrations_table().await? {
        return Err(not_a_backup(()));
    }

    let applied = file.applied_migrations().await?;
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

    Ok(json!({
        "path": path.display().to_string(),
        "schemaVersion": schema_version,
        "appSchemaVersion": app_version,
        "tables": file.row_counts().await?,
    }))
}

/// Checks that `path` is an intact HomeBase database this app can migrate,
/// and returns its schema version and row counts. Changes nothing.
pub(crate) async fn inspect_backup(path: &Path) -> CommandResult<Value> {
    if !path.is_file() {
        return Err(format!("File not found: {}", path.display()));
    }
    let mut file = DatabaseFile::open_read_only(path).await.map_err(not_a_backup)?;
    let result = check_backup(&mut file, path).await;
    file.close().await;
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
    let mut file = DatabaseFile::open_read_only(source).await.map_err(error_text)?;
    let copied = file.copy_to(&staged).await;
    file.close().await;
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
    instances.insert(DATABASE_URL.to_string(), DbPool::Sqlite(pool.clone()));
    // On one line: the arguments only run while a logger is active (not in tests).
    log::info!("Backup restored from {} (previous database kept as {})", source.display(), previous.display());
    set_aside_unused_files(dir, &pool, BEFORE_RESTORE_FOLDER).await
}

/// After a restore or import: backups and exports don't contain the attachment files
/// yet, so files the new data doesn't refer to are kept in `folder` instead of being
/// removed by the startup cleanup.
async fn set_aside_unused_files(dir: &Path, pool: &sqlx::Pool<sqlx::Sqlite>, folder: &str) -> CommandResult<()> {
    let moved = set_aside_orphans(dir, pool, folder).await.map_err(|error| {
        format!("Your data was replaced, but document files it doesn't use could not be moved to {folder}: {error}")
    })?;
    log::info!("{moved} attachment files the new data doesn't use were moved to {folder}");
    Ok(())
}

// ---------------------------------------------------------------------------
// Export & import
// ---------------------------------------------------------------------------

/// Writes all user data as one JSON document that [`import_json`] can read back.
pub(crate) async fn export_json(instances: &DbInstances, destination: &Path) -> CommandResult<()> {
    let pool = live_pool(instances).await?;
    let snapshot = read_snapshot(&pool).await?;

    let mut table_map = Map::new();
    for (name, columns, rows) in snapshot.tables {
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
        "exportedAt": snapshot.exported_at,
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
    let snapshot = read_snapshot(&pool).await?;

    let folder = directory.join(format!("homebase-export-{}", snapshot.local_stamp));
    fs::create_dir_all(&folder).map_err(|e| format!("Could not create {}: {e}", folder.display()))?;
    for (name, columns, rows) in snapshot.tables {
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

/// Replaces **all** data with the contents of a JSON export, in one transaction.
/// A snapshot of the previous data is kept as `homebase.before-import.db` in `dir`.
pub(crate) async fn import_json(dir: &Path, instances: &DbInstances, source: &str) -> CommandResult<()> {
    let (schema_version, _, mut tables) = parse_export(&read_export_file(source)?)?;
    upgrade_tables(schema_version, &mut tables);
    let pool = live_pool(instances).await?;
    vacuum_into(&pool, &before_import_path(dir)).await?;
    replace_all_data(&pool, &tables).await?;
    log::info!("JSON export imported: {source}");
    set_aside_unused_files(dir, &pool, BEFORE_IMPORT_FOLDER).await
}

#[cfg(test)]
mod tests;
