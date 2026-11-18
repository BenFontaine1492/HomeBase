//! `#[tauri::command]` wrappers (controller layer) for backup, restore, export,
//! import, attachment files and SQL transactions.
//!
//! Each one only resolves what needs a running app (the app data folder and the
//! SQL plugin's open databases) and calls into `data_transfer`, where the logic
//! lives and is tested. Excluded from the coverage gate, so keep logic out of here.

use std::path::{Path, PathBuf};
use std::time::Duration;

use serde_json::Value;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_sql::DbInstances;

use crate::attachments;
use crate::data_transfer;
use crate::db::{self, Statement};
use crate::error::CommandResult;

/// The folder that holds the live database (`app_config_dir`, see README).
fn config_dir<R: Runtime>(app: &AppHandle<R>) -> CommandResult<PathBuf> {
    app.path()
        .app_config_dir()
        .map_err(|error| format!("App data folder not found: {error}"))
}

#[tauri::command]
pub async fn create_backup<R: Runtime>(app: AppHandle<R>, destination: String) -> CommandResult<()> {
    data_transfer::create_backup(&config_dir(&app)?, &app.state::<DbInstances>(), Path::new(&destination)).await
}

#[tauri::command]
pub async fn inspect_backup(source: String) -> CommandResult<Value> {
    data_transfer::inspect_backup(Path::new(&source)).await
}

#[tauri::command]
pub async fn restore_backup<R: Runtime>(app: AppHandle<R>, source: String) -> CommandResult<()> {
    data_transfer::restore_backup(&config_dir(&app)?, &app.state::<DbInstances>(), Path::new(&source)).await
}

#[tauri::command]
pub async fn export_json<R: Runtime>(app: AppHandle<R>, destination: String) -> CommandResult<()> {
    data_transfer::export_json(&app.state::<DbInstances>(), Path::new(&destination)).await
}

#[tauri::command]
pub async fn export_csv<R: Runtime>(app: AppHandle<R>, directory: String) -> CommandResult<String> {
    data_transfer::export_csv(&app.state::<DbInstances>(), Path::new(&directory)).await
}

#[tauri::command]
pub async fn inspect_export(source: String) -> CommandResult<Value> {
    data_transfer::inspect_export(&source)
}

#[tauri::command]
pub async fn import_json<R: Runtime>(app: AppHandle<R>, source: String) -> CommandResult<()> {
    data_transfer::import_json(&config_dir(&app)?, &app.state::<DbInstances>(), &source).await
}

/// Copies a file the user picked into `attachments/`; returns `{ storedName, originalName, sizeBytes }`.
#[tauri::command]
pub async fn store_attachment_file<R: Runtime>(app: AppHandle<R>, source: String) -> CommandResult<Value> {
    attachments::store_file(&config_dir(&app)?, Path::new(&source))
}

/// Opens the file of attachment `id` with the system's default app.
#[tauri::command]
pub async fn open_attachment<R: Runtime>(app: AppHandle<R>, id: i64) -> CommandResult<()> {
    let path = attachments::attachment_path(&config_dir(&app)?, &app.state::<DbInstances>(), id).await?;
    open::that_detached(&path).map_err(|error| format!("Could not open the document: {error}"))
}

/// Deletes attachment files that no row refers to (any more). Run at startup; only logs.
pub async fn remove_orphan_attachments<R: Runtime>(app: AppHandle<R>) {
    let result = match config_dir(&app) {
        Ok(dir) => attachments::remove_orphans(&dir, &app.state::<DbInstances>(), ORPHAN_MIN_AGE).await,
        Err(error) => Err(error),
    };
    match result {
        Ok(removed) => log::info!("Attachment cleanup: {removed} unused files removed"),
        Err(error) => log::error!("Attachment cleanup failed: {error}"),
    }
}

/// Files younger than this are never removed by the cleanup: they may be being added right now.
const ORPHAN_MIN_AGE: Duration = Duration::from_secs(60 * 60);

#[tauri::command]
pub async fn execute_transaction<R: Runtime>(app: AppHandle<R>, statements: Vec<Statement>) -> CommandResult<Vec<Value>> {
    db::execute_transaction(&app.state::<DbInstances>(), &statements).await
}
