//! Files of attachments (documents) in the `attachments/` folder next to the
//! database (service layer).
//!
//! The frontend owns the `attachments` rows (metadata); this module only
//! handles the files:
//! * [`store_file`] copies a file the user picked into `attachments/` under a
//!   new unique name. The frontend then inserts the row.
//! * [`attachment_path`] resolves an attachment id to its file, for opening it.
//!   The frontend never passes a path into `attachments/`.
//! * [`remove_orphans`] deletes files that no row refers to (any more), e.g. after
//!   an object was deleted (the rows go with it via ON DELETE CASCADE). Runs at startup.
//! * [`set_aside_orphans`] moves such files into a side folder instead, after a
//!   restore or import: the replaced data may still need them.
//!
//! The database is the source of truth: a file without a row is garbage, a row
//! without a file is reported as "missing" when it is opened.
//!
//! Layers: `commands.rs` → this module → `repository.rs` (SQL) → `crate::db`.

mod repository;

use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::{self, ErrorKind};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};
use sqlx::Sqlite;
use tauri_plugin_sql::DbInstances;

use self::repository::{all_stored_names, stored_name_of};
use crate::db::live_pool;
use crate::error::CommandResult;

/// Folder of the attachment files, inside the app data folder.
const ATTACHMENTS_FOLDER: &str = "attachments";
/// Files the data no longer refers to after a restore (until backups include files).
pub(crate) const BEFORE_RESTORE_FOLDER: &str = "attachments.before-restore";
/// Files the data no longer refers to after an import.
pub(crate) const BEFORE_IMPORT_FOLDER: &str = "attachments.before-import";
/// Extensions longer than this (or with other characters than a–z, 0–9) are dropped.
const MAX_EXTENSION_LENGTH: usize = 10;

pub(crate) fn attachments_dir(config_dir: &Path) -> PathBuf {
    config_dir.join(ATTACHMENTS_FOLDER)
}

// ---------------------------------------------------------------------------
// Storing and resolving files
// ---------------------------------------------------------------------------

/// The extension of `source` for the stored name: `.pdf`, lower case; empty if it
/// is missing or unusual (stored names only contain `a–z 0–9 . -`).
fn stored_extension(source: &Path) -> String {
    let extension = source.extension().unwrap_or_default().to_string_lossy().to_ascii_lowercase();
    let usable = !extension.is_empty()
        && extension.len() <= MAX_EXTENSION_LENGTH
        && extension.is_ascii()
        && extension.chars().all(char::is_alphanumeric);
    if usable {
        format!(".{extension}")
    } else {
        String::new()
    }
}

/// True for names [`create_unique_file`] creates: no path separators, no leading dot.
fn is_valid_stored_name(name: &str) -> bool {
    !name.is_empty()
        && !name.starts_with('.')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
}

/// Creates a new, empty file `<stamp>-<n><extension>` in `dir` and returns its name.
/// `create_new` makes the name unique even if two files are stored at the same moment.
fn create_unique_file(dir: &Path, stamp: u128, extension: &str) -> CommandResult<(String, File)> {
    let mut attempt: u32 = 0;
    loop {
        let name = format!("{stamp:x}-{attempt:x}{extension}");
        match OpenOptions::new().write(true).create_new(true).open(dir.join(&name)) {
            Ok(file) => return Ok((name, file)),
            Err(error) if error.kind() == ErrorKind::AlreadyExists => attempt += 1,
            Err(error) => return Err(format!("Could not store the file in {}: {error}", dir.display())),
        }
    }
}

/// Copies `source` (a file the user picked) into `attachments/` under a new name.
/// Returns `{ storedName, originalName, sizeBytes }` for the attachment row.
pub(crate) fn store_file(config_dir: &Path, source: &Path) -> CommandResult<Value> {
    if !source.exists() {
        return Err(format!("File not found: {}", source.display()));
    }
    let dir = attachments_dir(config_dir);
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let (stored_name, mut output) = create_unique_file(&dir, stamp, &stored_extension(source))?;

    // A copy (not fs::copy) gives the new file the current time, which the orphan cleanup relies on.
    let copied = File::open(source).and_then(|mut input| io::copy(&mut input, &mut output));
    drop(output);
    let size_bytes = match copied {
        Ok(size) => size,
        Err(error) => {
            let _ = fs::remove_file(dir.join(&stored_name));
            return Err(format!("Could not copy {}: {error}", source.display()));
        }
    };
    let original_name = source.file_name().unwrap_or_default().to_string_lossy().into_owned();
    Ok(json!({ "storedName": stored_name, "originalName": original_name, "sizeBytes": size_bytes }))
}

fn unknown_document() -> String {
    "This document no longer exists.".to_string()
}

/// The file of attachment `id`, checked to exist.
pub(crate) async fn attachment_path(config_dir: &Path, instances: &DbInstances, id: i64) -> CommandResult<PathBuf> {
    let pool = live_pool(instances).await?;
    let stored_name = stored_name_of(&pool, id).await?.ok_or_else(unknown_document)?;
    // The name comes from the database, which an import can fill: never follow a path.
    if !is_valid_stored_name(&stored_name) {
        return Err("This document has an invalid file name.".into());
    }
    let path = attachments_dir(config_dir).join(stored_name);
    if !path.is_file() {
        return Err("The file of this document is missing. It may not have been part of a restored backup.".into());
    }
    Ok(path)
}

// ---------------------------------------------------------------------------
// Files without a row
// ---------------------------------------------------------------------------

/// How long ago `metadata`'s file was last written; zero if unknown or in the future.
fn file_age(metadata: &fs::Metadata, now: SystemTime) -> Duration {
    metadata
        .modified()
        .ok()
        .and_then(|modified| now.duration_since(modified).ok())
        .unwrap_or_default()
}

/// Files in `dir` whose names `keep` returns false for, and that are at least
/// `min_age` old. A missing `dir` has none.
fn files_in(dir: &Path, min_age: Duration, keep: impl Fn(&str) -> bool) -> CommandResult<Vec<PathBuf>> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("Could not read {}: {error}", dir.display())),
    };
    let now = SystemTime::now();
    let mut files = Vec::new();
    for entry in entries.flatten() {
        let Ok(metadata) = entry.metadata() else { continue };
        let name = entry.file_name().to_string_lossy().into_owned();
        if metadata.is_file() && !keep(&name) && file_age(&metadata, now) >= min_age {
            files.push(entry.path());
        }
    }
    Ok(files)
}

/// Deletes the files in `attachments/` that no attachment refers to and that are at
/// least `min_age` old (so a file that is being added right now is never removed).
/// Returns how many were deleted; a file that can't be deleted is left for next time.
pub(crate) async fn remove_orphans(config_dir: &Path, instances: &DbInstances, min_age: Duration) -> CommandResult<usize> {
    let referenced = all_stored_names(&live_pool(instances).await?).await?;
    let orphans = files_in(&attachments_dir(config_dir), min_age, |name| referenced.contains(name))?;
    Ok(orphans.into_iter().filter(|path| fs::remove_file(path).is_ok()).count())
}

/// Moves the files in `from` that `select` picks into `to`. Returns how many were moved.
fn move_files(from: &Path, to: &Path, select: impl Fn(&str) -> bool) -> CommandResult<usize> {
    let files = files_in(from, Duration::ZERO, |name| !select(name))?;
    if files.is_empty() {
        return Ok(0);
    }
    fs::create_dir_all(to).map_err(|e| format!("Could not create {}: {e}", to.display()))?;
    // Every path from files_in has a file name.
    let moved = files.iter().filter(|path| fs::rename(path, to.join(path.file_name().unwrap_or_default())).is_ok());
    Ok(moved.count())
}

/// After a restore or import replaced the data: moves the files the new data doesn't
/// refer to into `folder` (next to `attachments/`), replacing what an earlier restore
/// or import put there. Files the new data refers to are first taken back from the
/// side folders, so undoing a restore (restoring `homebase.before-restore.db`) finds
/// its files again. Returns how many files were set aside.
pub(crate) async fn set_aside_orphans(config_dir: &Path, pool: &sqlx::Pool<Sqlite>, folder: &str) -> CommandResult<usize> {
    let referenced: HashSet<String> = all_stored_names(pool).await?;
    let attachments = attachments_dir(config_dir);
    for side_folder in [BEFORE_RESTORE_FOLDER, BEFORE_IMPORT_FOLDER] {
        move_files(&config_dir.join(side_folder), &attachments, |name| referenced.contains(name))?;
    }
    let target = config_dir.join(folder);
    let _ = fs::remove_dir_all(&target);
    move_files(&attachments, &target, |name| !referenced.contains(name))
}

#[cfg(test)]
mod tests;
