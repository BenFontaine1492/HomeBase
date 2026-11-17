//! File names and path helpers shared by the data transfer service and repository.

use std::fs;
use std::path::{Path, PathBuf};

use crate::error::CommandResult;
use crate::DATABASE_URL;

/// File name of the live database (`homebase.db`), derived from `DATABASE_URL`.
fn database_file_name() -> &'static str {
    DATABASE_URL.trim_start_matches("sqlite:")
}

pub(super) fn live_database_path(dir: &Path) -> PathBuf {
    dir.join(database_file_name())
}

/// Temporary copy of the backup, swapped in once it is complete.
pub(super) fn staged_restore_path(dir: &Path) -> PathBuf {
    dir.join(format!("{}.restore", database_file_name()))
}

/// The database as it was before the last restore.
pub(super) fn before_restore_path(dir: &Path) -> PathBuf {
    dir.join("homebase.before-restore.db")
}

/// The database as it was before the last import.
pub(super) fn before_import_path(dir: &Path) -> PathBuf {
    dir.join("homebase.before-import.db")
}

/// `path` with `suffix` appended to the file name (e.g. `homebase.db-wal`).
pub(super) fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_owned();
    name.push(suffix);
    PathBuf::from(name)
}

pub(super) fn path_to_str(path: &Path) -> CommandResult<&str> {
    path.to_str()
        .ok_or_else(|| format!("Unsupported characters in path: {}", path.display()))
}

pub(super) fn is_same_file(a: &Path, b: &Path) -> bool {
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}
