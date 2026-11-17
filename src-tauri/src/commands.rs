//! `#[tauri::command]` wrappers (controller layer) for backup, restore, export,
//! import and SQL transactions.
//!
//! Each one only resolves what needs a running app (the app data folder and the
//! SQL plugin's open databases) and calls into `data_transfer`, where the logic
//! lives and is tested. Excluded from the coverage gate, so keep logic out of here.

use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_sql::DbInstances;

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

#[tauri::command]
pub async fn execute_transaction<R: Runtime>(app: AppHandle<R>, statements: Vec<Statement>) -> CommandResult<Vec<Value>> {
    db::execute_transaction(&app.state::<DbInstances>(), &statements).await
}
