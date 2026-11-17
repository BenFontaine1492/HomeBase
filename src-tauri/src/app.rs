//! Tauri builder, plugins and fatal startup error handling.
//!
//! Wiring only (needs a running Tauri app), so this file is excluded from the
//! coverage gate. Put testable logic into `startup.rs` or another module.

use tauri_plugin_log::{RotationStrategy, Target, TargetKind, TimezoneStrategy};

use crate::{commands, migrations, startup, DATABASE_URL};

/// Base name of the log file (`homebase.log`) in the platform's log folder.
const LOG_FILE_NAME: &str = "homebase";

/// Rotate at 1 MB and keep a few old files, so logs never grow unbounded.
const LOG_MAX_FILE_SIZE: u128 = 1_000_000;
const LOG_KEEP_FILES: usize = 5;

fn log_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    let level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };
    tauri_plugin_log::Builder::new()
        .targets([
            Target::new(TargetKind::LogDir {
                file_name: Some(LOG_FILE_NAME.into()),
            }),
            Target::new(TargetKind::Stdout),
        ])
        .level(level)
        // sqlx logs every statement at Debug; keep only its warnings (e.g. slow queries).
        .level_for("sqlx", log::LevelFilter::Warn)
        .max_file_size(LOG_MAX_FILE_SIZE)
        .rotation_strategy(RotationStrategy::KeepSome(LOG_KEEP_FILES))
        .timezone_strategy(TimezoneStrategy::UseLocal)
        .build()
}

/// Writes panics to the log file as well (release builds have no console).
fn install_panic_logger() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        log::error!("Panic: {info}");
        log::logger().flush();
        default_hook(info);
    }));
}

/// Logs a fatal startup error and shows it in a native message box.
///
/// Called after `run()` failed, so there is no app or event loop anymore: the
/// dialog plugin needs an `AppHandle`, therefore `rfd` (which the dialog plugin
/// uses internally) is called directly. It blocks until the user closes it.
fn report_startup_error(error: &tauri::Error) {
    log::error!("HomeBase failed to start: {error}");
    log::logger().flush();
    eprintln!("HomeBase failed to start: {error}");

    rfd::MessageDialog::new()
        .set_level(rfd::MessageLevel::Error)
        .set_title("HomeBase")
        .set_description(startup::startup_error_message(error))
        .set_buttons(rfd::MessageButtons::Ok)
        .show();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    install_panic_logger();

    let result = tauri::Builder::default()
        // Registered first: plugins are set up in order, so the logger is ready
        // before the SQL plugin opens and migrates the database.
        .plugin(log_plugin())
        .plugin(tauri_plugin_dialog::init())
        // The database is preloaded (see tauri.conf.json): the plugin opens it and
        // applies pending migrations during setup, before any window is created.
        // If a migration fails, its transaction is rolled back and startup aborts
        // (reported by `report_startup_error`), so the app never runs against a
        // partially migrated schema.
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_URL, migrations::all())
                .build(),
        )
        .setup(|app| {
            log::info!(
                "HomeBase {} started, database ready (schema version {})",
                app.package_info().version,
                migrations::app_schema_version()
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_backup,
            commands::inspect_backup,
            commands::restore_backup,
            commands::export_json,
            commands::export_csv,
            commands::inspect_export,
            commands::import_json,
            commands::execute_transaction,
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        report_startup_error(&error);
        std::process::exit(1);
    }
}
