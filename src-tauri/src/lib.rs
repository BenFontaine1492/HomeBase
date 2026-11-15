mod data_transfer;
mod migrations;

use tauri_plugin_log::{RotationStrategy, Target, TargetKind, TimezoneStrategy};

/// Connection string of the application database.
///
/// The SQL plugin resolves relative SQLite paths against the platform's
/// application directory (`%APPDATA%\com.homebase.desktop` on Windows,
/// see README → "Database location").
/// Must match `DATABASE_URL` in `src/services/database/database.service.ts`
/// and the `plugins.sql.preload` entry in `tauri.conf.json`.
pub const DATABASE_URL: &str = "sqlite:homebase.db";

/// Base name of the log file (`homebase.log`) in the platform's log folder.
const LOG_FILE_NAME: &str = "homebase";

/// Rotate at 1 MB and keep a few old files, so logs never grow unbounded.
const LOG_MAX_FILE_SIZE: u128 = 1_000_000;
const LOG_KEEP_FILES: usize = 5;

/// Where the log plugin writes (`app_log_dir`), for the startup error dialog:
/// without a running app there is no `AppHandle` to resolve the path.
#[cfg(target_os = "windows")]
const LOG_DIR_HINT: &str = r"%LOCALAPPDATA%\com.homebase.desktop\logs";
#[cfg(target_os = "macos")]
const LOG_DIR_HINT: &str = "~/Library/Logs/com.homebase.desktop";
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
const LOG_DIR_HINT: &str = "~/.local/share/com.homebase.desktop/logs";

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

/// Text of the startup error dialog.
fn startup_error_message(error: &tauri::Error) -> String {
    let cause = match error {
        // Raised by the SQL plugin's setup: opening the preloaded database or a migration failed.
        // Each migration runs in a transaction, so a failed one leaves the schema at the previous version.
        tauri::Error::PluginInitialization(plugin, _) if plugin == "sql" => {
            "The database could not be opened or updated to the current version. \
             A failed update is rolled back, so the database stays at its previous version.\n\n"
        }
        _ => "",
    };
    format!(
        "HomeBase could not start.\n\n{cause}Details:\n{error}\n\nThe log files are in:\n{LOG_DIR_HINT}"
    )
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
        .set_description(startup_error_message(error))
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
                data_transfer::app_schema_version()
            );
            Ok(())
        })
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
        report_startup_error(&error);
        std::process::exit(1);
    }
}
