//! Tests for the data transfer service and its repository. They work on real
//! SQLite files in a temporary folder and register pools in a [`DbInstances`],
//! like the SQL plugin does.
//!
//! Coverage is measured on test code too, so avoid branches that never run
//! (use `unwrap_err()` instead of `match … => panic!`).

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{ConnectOptions, Connection};
use tauri_plugin_sql::DbInstances;

use super::paths::*;
use super::repository::*;
use super::*;
use crate::attachments::{attachments_dir, BEFORE_IMPORT_FOLDER, BEFORE_RESTORE_FOLDER};
use crate::db::live_pool;
use crate::error::error_text;
use crate::migrations::{app_migrations, app_schema_version};
use crate::test_support::{instances_with, run, Pool, TestDir};

/// The live database in `dir`, migrated and filled with [`seed`] data.
async fn live_database(dir: &TestDir) -> DbInstances {
    let pool = open_and_migrate(&live_database_path(&dir.0)).await.unwrap();
    seed(&pool).await;
    instances_with(pool).await
}

/// One category, one object in it (with one attribute) and one investment.
async fn seed(pool: &Pool) {
    for sql in [
        r#"INSERT INTO household_categories (id, name, icon, description) VALUES (1, 'Heating', 'mdi-radiator', 'Says "hi", twice')"#,
        "INSERT INTO household_objects (id, name, category_id, purchase_price_cents, notes) VALUES (1, 'Heat pump', 1, 1500000, 'line 1\nline 2')",
        "INSERT INTO household_object_attributes (household_object_id, name, value_type, value, unit) VALUES (1, 'Power', 'number', '12.5', 'kW')",
        "INSERT INTO investments (id, title, estimated_cost_cents, priority) VALUES (1, 'Roof', 100, 'high')",
    ] {
        execute(pool, sql).await;
    }
}

async fn execute(pool: &Pool, sql: &str) {
    sqlx::query(sql).execute(pool).await.unwrap();
}

async fn count(pool: &Pool, table: &str) -> i64 {
    sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}")).fetch_one(pool).await.unwrap()
}

async fn pool_of(instances: &DbInstances) -> Pool {
    live_pool(instances).await.unwrap()
}

/// Closes the live pool, so the temporary folder can be deleted (Windows locks open files).
async fn close(instances: &DbInstances) {
    pool_of(instances).await.close().await;
}

/// A database file at `path` with `migrations` applied and `sql` run afterwards.
async fn database_file(path: &Path, migrations: Vec<sqlx::migrate::Migration>, sql: &[&str]) {
    let pool = open_with_migrations(path, migrations).await.unwrap();
    for statement in sql {
        execute(&pool, statement).await;
    }
    pool.close().await;
}

/// A valid backup with different data than [`seed`].
async fn other_backup(path: &Path) {
    database_file(
        path,
        app_migrations(),
        &["INSERT INTO investments (title, estimated_cost_cents, priority) VALUES ('Windows', 5, 'low')"],
    )
    .await;
}

/// An SQLite database that was not created by HomeBase (no migrations table).
async fn plain_database(path: &Path, sql: &str) {
    let mut conn = SqliteConnectOptions::new().filename(path).create_if_missing(true).connect().await.unwrap();
    sqlx::query(sql).execute(&mut conn).await.unwrap();
    conn.close().await.unwrap();
}

/// Every row of every user table, for comparisons.
async fn all_data(pool: &Pool) -> Vec<TableData> {
    let mut conn = pool.acquire().await.unwrap();
    read_all_tables(&mut conn).await.unwrap()
}

fn seeded_row_counts() -> Value {
    json!([
        { "name": "attachments", "rows": 0 },
        { "name": "dashboard_widgets", "rows": 3 },
        { "name": "household_categories", "rows": 1 },
        { "name": "household_object_attributes", "rows": 1 },
        { "name": "household_objects", "rows": 1 },
        { "name": "investments", "rows": 1 },
        { "name": "maintenance_records", "rows": 0 },
        { "name": "maintenance_tasks", "rows": 0 },
        { "name": "settings", "rows": 0 },
    ])
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

#[test]
fn quotes_identifiers() {
    assert_eq!(quote_identifier(r#"odd"name"#), r#""odd""name""#);
}

#[test]
fn reports_damage_found_by_quick_check() {
    assert_eq!(ensure_intact("ok"), Ok(()));
    assert_eq!(
        ensure_intact("Page 3 is never used").unwrap_err(),
        "The backup is damaged: Page 3 is never used"
    );
}

#[test]
fn error_helpers_produce_the_frontend_text() {
    assert_eq!(error_text(sqlx::Error::RowNotFound), sqlx::Error::RowNotFound.to_string());
    assert_eq!(not_a_backup(sqlx::Error::RowNotFound), "This file is not a HomeBase backup.");
}

/// A path that can't be passed to SQLite as UTF-8 (an unpaired surrogate on Windows).
#[cfg(windows)]
fn non_utf8_path() -> PathBuf {
    use std::os::windows::ffi::OsStringExt;
    PathBuf::from(std::ffi::OsString::from_wide(&[0x61, 0xD800]))
}

/// A path that can't be passed to SQLite as UTF-8 (an invalid byte on Unix).
#[cfg(unix)]
fn non_utf8_path() -> PathBuf {
    use std::os::unix::ffi::OsStringExt;
    PathBuf::from(std::ffi::OsString::from_vec(vec![0x61, 0xFF]))
}

#[test]
fn rejects_paths_that_are_not_utf8() {
    let error = path_to_str(&non_utf8_path()).unwrap_err();
    assert!(error.starts_with("Unsupported characters in path: "), "{error}");
}

#[test]
fn reports_a_database_that_cannot_be_opened() {
    run(async {
        let dir = TestDir::new();
        let error = open_and_migrate(&dir.path("missing-folder").join("homebase.db")).await.unwrap_err();
        assert!(error.starts_with("Could not open the database: "), "{error}");
    });
}

#[test]
fn commands_need_an_open_database() {
    run(async {
        let dir = TestDir::new();
        let none = DbInstances::default();
        let not_open = "The database is not open.";
        assert_eq!(create_backup(&dir.0, &none, &dir.path("b.db")).await.unwrap_err(), not_open);
        assert_eq!(export_json(&none, &dir.path("e.json")).await.unwrap_err(), not_open);
        assert_eq!(export_csv(&none, &dir.0).await.unwrap_err(), not_open);
    });
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

#[test]
fn backup_writes_a_valid_copy_and_replaces_old_files() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        let destination = dir.path("backup.db");
        // An older backup and the leftover of an interrupted one are replaced.
        fs::write(&destination, "old backup").unwrap();
        fs::write(with_suffix(&destination, ".tmp"), "stale").unwrap();

        create_backup(&dir.0, &instances, &destination).await.unwrap();

        let info = inspect_backup(&destination).await.unwrap();
        assert_eq!(info["path"], destination.display().to_string());
        assert_eq!(info["schemaVersion"], app_schema_version());
        assert_eq!(info["appSchemaVersion"], app_schema_version());
        assert_eq!(info["tables"], seeded_row_counts());
        assert!(!with_suffix(&destination, ".tmp").exists());
        close(&instances).await;
    });
}

#[test]
fn backup_refuses_the_live_database_as_destination() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        let error = create_backup(&dir.0, &instances, &live_database_path(&dir.0)).await.unwrap_err();
        assert_eq!(error, "Choose a different file: this is the live database.");
        close(&instances).await;
    });
}

#[test]
fn backup_reports_a_leftover_that_cannot_be_removed() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        let destination = dir.path("backup.db");
        // A folder where the temporary file goes cannot be deleted with remove_file.
        fs::create_dir(with_suffix(&destination, ".tmp")).unwrap();

        let error = create_backup(&dir.0, &instances, &destination).await.unwrap_err();

        assert!(error.starts_with("Could not replace "), "{error}");
        close(&instances).await;
    });
}

#[test]
fn moving_database_files_reports_a_missing_target_folder() {
    let dir = TestDir::new();
    let source = dir.path("source.db");
    fs::write(&source, "data").unwrap();

    let error = move_database_files(&source, &dir.path("missing-folder").join("target.db")).unwrap_err();

    assert!(error.starts_with("Could not move "), "{error}");
    assert!(source.is_file(), "the source must stay where it was");
}

#[test]
fn backup_reports_a_folder_that_does_not_exist() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        let destination = dir.path("missing-folder").join("backup.db");

        let error = create_backup(&dir.0, &instances, &destination).await.unwrap_err();

        assert!(error.starts_with("Could not write the backup: "), "{error}");
        close(&instances).await;
    });
}

#[test]
fn backup_reports_a_destination_that_cannot_be_replaced() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        let destination = dir.path("folder.db");
        fs::create_dir(&destination).unwrap();

        let error = create_backup(&dir.0, &instances, &destination).await.unwrap_err();
        assert!(error.starts_with("Could not save"), "{error}");
        assert!(!with_suffix(&destination, ".tmp").exists());
        close(&instances).await;
    });
}

// ---------------------------------------------------------------------------
// Inspect backup
// ---------------------------------------------------------------------------

#[test]
fn inspect_rejects_files_that_are_not_backups() {
    run(async {
        let dir = TestDir::new();
        let missing = dir.path("missing.db");
        assert_eq!(
            inspect_backup(&missing).await.unwrap_err(),
            format!("File not found: {}", missing.display())
        );

        let not_a_backup = "This file is not a HomeBase backup.";
        let text = dir.path("notes.db");
        fs::write(&text, "just some text, not an SQLite database").unwrap();
        assert_eq!(inspect_backup(&text).await.unwrap_err(), not_a_backup);

        let foreign = dir.path("foreign.db");
        plain_database(&foreign, "CREATE TABLE things (id INTEGER)").await;
        assert_eq!(inspect_backup(&foreign).await.unwrap_err(), not_a_backup);

        // The migrations table exists, but no migration was ever applied.
        let empty = dir.path("empty.db");
        database_file(&empty, Vec::new(), &[]).await;
        assert_eq!(inspect_backup(&empty).await.unwrap_err(), not_a_backup);
    });
}

#[test]
fn inspect_rejects_backups_this_version_cannot_open() {
    run(async {
        let dir = TestDir::new();
        let cases = [
            (
                "UPDATE _sqlx_migrations SET success = 0 WHERE version = 2",
                "The backup contains an incomplete migration (version 2).".to_string(),
            ),
            (
                "INSERT INTO _sqlx_migrations (version, description, success, checksum, execution_time) VALUES (99, 'future', 1, x'00', 0)",
                format!(
                    "The backup was created by a newer version of HomeBase (schema 99, this app supports up to {}). Update HomeBase first.",
                    app_schema_version()
                ),
            ),
            (
                "UPDATE _sqlx_migrations SET checksum = x'00' WHERE version = 1",
                "The backup's schema (migration 1) does not match this version of HomeBase.".to_string(),
            ),
        ];
        for (index, (sql, expected)) in cases.iter().enumerate() {
            let path = dir.path(&format!("case-{index}.db"));
            database_file(&path, app_migrations(), &[*sql]).await;
            assert_eq!(&inspect_backup(&path).await.unwrap_err(), expected);
        }
    });
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

#[test]
fn restore_replaces_the_live_database_and_keeps_the_previous_one() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        let backup = dir.path("backup.db");
        other_backup(&backup).await;

        restore_backup(&dir.0, &instances, &backup).await.unwrap();

        let pool = pool_of(&instances).await;
        assert_eq!(count(&pool, "household_objects").await, 0);
        let titles: Vec<String> = sqlx::query_scalar("SELECT title FROM investments").fetch_all(&pool).await.unwrap();
        assert_eq!(titles, ["Windows"]);
        assert!(before_restore_path(&dir.0).is_file());
        assert!(!staged_restore_path(&dir.0).exists());

        // Restoring again replaces the copy kept from the first restore.
        restore_backup(&dir.0, &instances, &backup).await.unwrap();
        close(&instances).await;
    });
}

/// Backups don't contain the attachment files yet: files the restored data doesn't
/// use are moved aside, not left for the startup cleanup to delete.
#[test]
fn restore_sets_aside_files_the_restored_data_does_not_use() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        let backup = dir.path("backup.db");
        other_backup(&backup).await;
        fs::create_dir_all(attachments_dir(&dir.0)).unwrap();
        fs::write(attachments_dir(&dir.0).join("invoice.pdf"), "pdf").unwrap();

        restore_backup(&dir.0, &instances, &backup).await.unwrap();

        assert!(dir.path(BEFORE_RESTORE_FOLDER).join("invoice.pdf").is_file());
        assert!(!attachments_dir(&dir.0).join("invoice.pdf").exists());
        close(&instances).await;
    });
}

#[test]
fn restore_reports_files_that_cannot_be_set_aside_but_keeps_the_restored_data() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        let backup = dir.path("backup.db");
        other_backup(&backup).await;
        // attachments/ is a file, so it can't be read.
        fs::write(attachments_dir(&dir.0), "not a folder").unwrap();

        let error = restore_backup(&dir.0, &instances, &backup).await.unwrap_err();

        assert!(error.starts_with("Your data was replaced, but document files"), "{error}");
        assert_eq!(count(&pool_of(&instances).await, "household_objects").await, 0);
        close(&instances).await;
    });
}

#[test]
fn restore_works_when_no_database_is_open() {
    run(async {
        let dir = TestDir::new();
        let backup = dir.path("backup.db");
        other_backup(&backup).await;
        // Startup failed, so the SQL plugin has no open database.
        let instances = DbInstances::default();

        restore_backup(&dir.0, &instances, &backup).await.unwrap();

        assert_eq!(count(&pool_of(&instances).await, "investments").await, 1);
        close(&instances).await;
    });
}

#[test]
fn restore_migrates_an_older_backup() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        let backup = dir.path("schema-1.db");
        database_file(&backup, app_migrations()[..1].to_vec(), &[]).await;
        assert_eq!(inspect_backup(&backup).await.unwrap()["schemaVersion"], 1);

        restore_backup(&dir.0, &instances, &backup).await.unwrap();

        // household_objects only exists from migration 2 on.
        assert_eq!(count(&pool_of(&instances).await, "household_objects").await, 0);
        close(&instances).await;
    });
}

#[test]
fn restore_refuses_invalid_sources_without_touching_the_live_database() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;

        let error = restore_backup(&dir.0, &instances, &live_database_path(&dir.0)).await.unwrap_err();
        assert_eq!(error, "This is the live database, there is nothing to restore.");
        let error = restore_backup(&dir.0, &instances, &dir.path("missing.db")).await.unwrap_err();
        assert!(error.starts_with("File not found"), "{error}");

        assert_eq!(count(&pool_of(&instances).await, "investments").await, 1);
        close(&instances).await;
    });
}

#[test]
fn restore_rolls_back_when_the_live_database_cannot_be_moved() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        let backup = dir.path("backup.db");
        other_backup(&backup).await;
        // A folder where the previous database should be kept cannot be replaced.
        fs::create_dir(before_restore_path(&dir.0)).unwrap();

        let error = restore_backup(&dir.0, &instances, &backup).await.unwrap_err();

        assert!(error.ends_with("Your data was not changed."), "{error}");
        assert_eq!(count(&pool_of(&instances).await, "household_objects").await, 1);
        assert!(!staged_restore_path(&dir.0).exists());
        close(&instances).await;
    });
}

#[test]
fn restore_rolls_back_when_the_backup_cannot_be_migrated() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        // Schema 1 plus a table that clashes with migration 2.
        let backup = dir.path("clashing.db");
        database_file(&backup, app_migrations()[..1].to_vec(), &["CREATE TABLE household_objects (id INTEGER)"]).await;

        let error = restore_backup(&dir.0, &instances, &backup).await.unwrap_err();

        assert!(error.starts_with("Could not update the database"), "{error}");
        assert!(error.ends_with("Your data was not changed."), "{error}");
        assert_eq!(count(&pool_of(&instances).await, "household_objects").await, 1);
        close(&instances).await;
    });
}

#[test]
fn restore_reports_when_the_rollback_fails_too() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        // The live database no longer matches the app's migrations, so it cannot be reopened.
        execute(&pool_of(&instances).await, "UPDATE _sqlx_migrations SET checksum = x'00' WHERE version = 1").await;
        let backup = dir.path("backup.db");
        other_backup(&backup).await;
        fs::create_dir(before_restore_path(&dir.0)).unwrap();

        let error = restore_backup(&dir.0, &instances, &backup).await.unwrap_err();

        assert!(error.contains("Reopening the previous database also failed"), "{error}");
        assert!(error.ends_with("Restart HomeBase."), "{error}");
    });
}

// ---------------------------------------------------------------------------
// Export & import
// ---------------------------------------------------------------------------

/// Writes an export with the given `tables` and imports it into a fresh live database with [`seed`] data.
async fn import_tables(tables: Value) -> (TestDir, DbInstances, CommandResult<()>) {
    let dir = TestDir::new();
    let instances = live_database(&dir).await;
    let file = dir.path("import.json");
    let document = json!({
        "format": EXPORT_FORMAT,
        "formatVersion": EXPORT_FORMAT_VERSION,
        "schemaVersion": app_schema_version(),
        "tables": tables,
    });
    fs::write(&file, document.to_string()).unwrap();
    let result = import_json(&dir.0, &instances, path_to_str(&file).unwrap()).await;
    (dir, instances, result)
}

#[test]
fn json_export_and_import_round_trip() {
    run(async {
        let dir = TestDir::new();
        let source = live_database(&dir).await;
        let file = dir.path("export.json");
        export_json(&source, &file).await.unwrap();

        let document: Value = serde_json::from_str(&fs::read_to_string(&file).unwrap()).unwrap();
        assert_eq!(document["format"], EXPORT_FORMAT);
        assert_eq!(document["formatVersion"], EXPORT_FORMAT_VERSION);
        assert_eq!(document["tables"]["household_objects"][0]["category_id"], 1);

        // The target has other data, which the import replaces.
        let target_dir = TestDir::new();
        let target_pool = open_and_migrate(&live_database_path(&target_dir.0)).await.unwrap();
        execute(&target_pool, "INSERT INTO investments (title, estimated_cost_cents, priority) VALUES ('Gone', 1, 'low')").await;
        let target = instances_with(target_pool.clone()).await;

        import_json(&target_dir.0, &target, path_to_str(&file).unwrap()).await.unwrap();

        assert_eq!(all_data(&target_pool).await, all_data(&pool_of(&source).await).await);
        assert!(before_import_path(&target_dir.0).is_file());
        close(&source).await;
        close(&target).await;
    });
}

#[test]
fn import_sets_aside_files_the_imported_data_does_not_use() {
    run(async {
        let (dir, instances, result) = import_tables(json!({})).await;
        result.unwrap();
        // The import above emptied every table; a file added before an import is now unused.
        fs::create_dir_all(attachments_dir(&dir.0)).unwrap();
        fs::write(attachments_dir(&dir.0).join("manual.pdf"), "pdf").unwrap();
        let file = dir.path("empty.json");
        export_json(&instances, &file).await.unwrap();

        import_json(&dir.0, &instances, path_to_str(&file).unwrap()).await.unwrap();

        assert!(dir.path(BEFORE_IMPORT_FOLDER).join("manual.pdf").is_file());
        close(&instances).await;
    });
}

#[test]
fn inspect_export_summarises_an_export() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        let file = dir.path("export.json");
        export_json(&instances, &file).await.unwrap();
        let path = path_to_str(&file).unwrap();

        let info = inspect_export(path).unwrap();

        assert_eq!(info["path"], path);
        assert_eq!(info["schemaVersion"], app_schema_version());
        assert_eq!(info["appSchemaVersion"], app_schema_version());
        assert_eq!(info["exportedAt"].as_str().unwrap().len(), "2026-01-01T00:00:00Z".len());
        assert_eq!(info["tables"], seeded_row_counts());
        close(&instances).await;
    });
}

#[test]
fn reading_an_export_reports_missing_files() {
    let error = inspect_export("does-not-exist.json").unwrap_err();
    assert!(error.starts_with("Could not read does-not-exist.json"), "{error}");
}

#[test]
fn parse_export_rejects_malformed_documents() {
    let invalid = "This file is not a HomeBase export.".to_string();
    let header = r#""format":"homebase-export","formatVersion":1"#;
    let cases = [
        ("not json".to_string(), invalid.clone()),
        (r#"{"format":"other"}"#.to_string(), invalid.clone()),
        (
            r#"{"format":"homebase-export","formatVersion":2}"#.to_string(),
            "This export uses an unsupported format version.".to_string(),
        ),
        (format!("{{{header}}}"), invalid.clone()),
        (
            format!(r#"{{{header},"schemaVersion":99,"tables":{{}}}}"#),
            format!(
                "The export was created by a newer version of HomeBase (schema 99, this app supports up to {}). Update HomeBase first.",
                app_schema_version()
            ),
        ),
        (format!(r#"{{{header},"schemaVersion":1}}"#), invalid.clone()),
        (format!(r#"{{{header},"schemaVersion":1,"tables":{{"investments":{{}}}}}}"#), invalid.clone()),
        (
            format!(r#"{{{header},"schemaVersion":1,"tables":{{"investments":[1]}}}}"#),
            "Table investments in the export is malformed.".to_string(),
        ),
    ];
    for (text, expected) in cases {
        assert_eq!(parse_export(&text).unwrap_err(), expected, "{text}");
    }
}

#[test]
fn parse_export_accepts_a_missing_timestamp() {
    let text = r#"{"format":"homebase-export","formatVersion":1,"schemaVersion":1,"tables":{"investments":[]}}"#;
    let (schema_version, exported_at, tables) = parse_export(text).unwrap();
    assert_eq!((schema_version, exported_at.as_str(), tables.len()), (1, "", 1));
}

#[test]
fn import_rejects_unusable_data_and_keeps_the_existing_data() {
    run(async {
        let cases = [
            (json!({ "gadgets": [] }), "The export contains an unknown table: gadgets"),
            (json!({ "investments": [{ "colour": "red" }] }), "Unknown column colour in table investments."),
            (json!({ "investments": [{ "title": ["a"] }] }), "Unsupported value in investments, row 1."),
            (
                json!({ "investments": [{ "title": " ", "estimated_cost_cents": 1, "priority": "low" }] }),
                "Could not import investments, row 1: ",
            ),
            // The category does not exist: caught when the transaction commits.
            (
                json!({ "household_objects": [{ "name": "Lost", "category_id": 99 }] }),
                "The export is inconsistent and was not imported: ",
            ),
        ];
        for (tables, expected) in cases {
            let (_dir, instances, result) = import_tables(tables).await;
            let error = result.unwrap_err();
            assert!(error.starts_with(expected), "{error}");
            let pool = pool_of(&instances).await;
            assert_eq!(count(&pool, "investments").await, 1);
            assert_eq!(count(&pool, "household_objects").await, 1);
            close(&instances).await;
        }
    });
}

#[test]
fn import_converts_booleans_and_keeps_real_numbers() {
    run(async {
        let (_dir, instances, result) = import_tables(json!({
            "investments": [{
                "title": "Solar",
                "description": null,
                "estimated_cost_cents": true,
                "priority": "low",
                "sort_order": 2.5,
            }],
        }))
        .await;
        result.unwrap();

        let data = all_data(&pool_of(&instances).await).await;
        let (_, columns, rows) = data.iter().find(|(name, _, _)| name == "investments").unwrap();
        let row: Map<String, Value> = columns.iter().cloned().zip(rows[0].clone()).collect();
        assert_eq!(row["estimated_cost_cents"], 1);
        assert_eq!(row["sort_order"], 2.5);
        assert_eq!(row["description"], Value::Null);
        // Tables missing from the export end up empty.
        assert_eq!(count(&pool_of(&instances).await, "household_objects").await, 0);
        close(&instances).await;
    });
}

#[test]
fn export_refuses_binary_values() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;
        execute(&pool_of(&instances).await, "UPDATE investments SET description = x'00ff'").await;

        let error = export_json(&instances, &dir.path("export.json")).await.unwrap_err();

        assert_eq!(error, "Column type BLOB cannot be exported.");
        close(&instances).await;
    });
}

#[test]
fn csv_export_writes_one_file_per_table() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;

        let folder = PathBuf::from(export_csv(&instances, &dir.0).await.unwrap());

        assert!(folder.starts_with(&dir.0));
        assert!(folder.file_name().unwrap().to_str().unwrap().starts_with("homebase-export-"));
        let categories = fs::read_to_string(folder.join("household_categories.csv")).unwrap();
        // BOM, header, CRLF, and a quoted field with doubled quotes.
        let expected = "\u{feff}id,name,icon,description,created_at,updated_at\r\n1,Heating,mdi-radiator,\"Says \"\"hi\"\", twice\",";
        // Keep custom assert messages on one line: a message on its own line only runs on failure and counts as uncovered.
        assert!(categories.starts_with(expected), "{categories}");
        let objects = fs::read_to_string(folder.join("household_objects.csv")).unwrap();
        assert!(objects.contains(",\"line 1\nline 2\","), "{objects}");
        assert!(folder.join("investments.csv").is_file());
        close(&instances).await;
    });
}

#[test]
fn exports_report_destinations_that_cannot_be_written() {
    run(async {
        let dir = TestDir::new();
        let instances = live_database(&dir).await;

        // JSON: the chosen file is actually a folder.
        let folder = dir.path("export.json");
        fs::create_dir(&folder).unwrap();
        let error = export_json(&instances, &folder).await.unwrap_err();
        assert!(error.starts_with("Could not write "), "{error}");

        // CSV: the chosen "folder" is actually a file, so no subfolder can be created in it.
        let file = dir.path("not-a-folder.txt");
        fs::write(&file, "x").unwrap();
        let error = export_csv(&instances, &file).await.unwrap_err();
        assert!(error.starts_with("Could not create "), "{error}");

        close(&instances).await;
    });
}

#[test]
fn csv_fields_are_quoted_when_needed() {
    assert_eq!(csv_field(&Value::Null), "");
    assert_eq!(csv_field(&json!("plain")), "plain");
    assert_eq!(csv_field(&json!(12)), "12");
    assert_eq!(csv_field(&json!("a,b")), "\"a,b\"");
    assert_eq!(csv_field(&json!("say \"hi\"")), "\"say \"\"hi\"\"\"");
    assert_eq!(csv_field(&json!("a\r\nb")), "\"a\r\nb\"");
}
