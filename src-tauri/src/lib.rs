mod data_transfer;
mod migrations;

/// Connection string of the application database.
///
/// The SQL plugin resolves relative SQLite paths against the platform's
/// application directory (`%APPDATA%\com.homebase.desktop` on Windows,
/// see README → "Database location").
/// Must match `DATABASE_URL` in `src/services/database/database.service.ts`
/// and the `plugins.sql.preload` entry in `tauri.conf.json`.
pub const DATABASE_URL: &str = "sqlite:homebase.db";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // The database is preloaded (see tauri.conf.json): the plugin opens it and
        // applies pending migrations during setup, before any window is created.
        // If a migration fails, its transaction is rolled back and startup aborts,
        // so the app never runs against a partially migrated schema.
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_URL, migrations::all())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            data_transfer::create_backup,
            data_transfer::inspect_backup,
            data_transfer::restore_backup,
            data_transfer::export_json,
            data_transfer::export_csv,
            data_transfer::inspect_export,
            data_transfer::import_json,
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("HomeBase failed to start: {error}");
        std::process::exit(1);
    }
}
