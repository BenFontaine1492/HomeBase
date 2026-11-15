//! Text of the fatal startup error dialog (shown by `app::report_startup_error`).

/// Where the log plugin writes (`app_log_dir`), for the startup error dialog:
/// without a running app there is no `AppHandle` to resolve the path.
#[cfg(target_os = "windows")]
const LOG_DIR_HINT: &str = r"%LOCALAPPDATA%\com.homebase.desktop\logs";
#[cfg(target_os = "macos")]
const LOG_DIR_HINT: &str = "~/Library/Logs/com.homebase.desktop";
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
const LOG_DIR_HINT: &str = "~/.local/share/com.homebase.desktop/logs";

/// Text of the startup error dialog.
pub(crate) fn startup_error_message(error: &tauri::Error) -> String {
    let cause = match error {
        // Raised by the SQL plugin's setup: opening the preloaded database or a migration failed.
        // Each migration runs in a transaction, so a failed one leaves the schema at the previous version.
        tauri::Error::PluginInitialization(plugin, _) if plugin == "sql" => {
            "The database could not be opened or updated to the current version. \
             A failed update is rolled back, so the database stays at its previous version.\n\n"
        }
        _ => "",
    };
    format!("HomeBase could not start.\n\n{cause}Details:\n{error}\n\nThe log files are in:\n{LOG_DIR_HINT}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn explains_database_failures() {
        let error = tauri::Error::PluginInitialization("sql".into(), "migration 3 failed".into());
        let message = startup_error_message(&error);
        assert!(message.starts_with("HomeBase could not start.\n\nThe database could not be opened"));
        assert!(message.contains("migration 3 failed"));
        assert!(message.ends_with(LOG_DIR_HINT));
    }

    #[test]
    fn shows_only_the_details_for_other_failures() {
        let other_plugin = tauri::Error::PluginInitialization("log".into(), "no log folder".into());
        let message = startup_error_message(&other_plugin);
        assert!(message.starts_with("HomeBase could not start.\n\nDetails:\n"));
        assert!(message.contains("no log folder"));

        let message = startup_error_message(&tauri::Error::FailedToReceiveMessage);
        assert!(message.starts_with("HomeBase could not start.\n\nDetails:\n"));
    }
}
