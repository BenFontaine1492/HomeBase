//! Export for a tax advisor (service layer): a new folder with a summary workbook
//! (`.xlsx`) and copies of the receipts, one subfolder per tax category.
//!
//! The frontend builds the whole plan (texts in the user's language, file names,
//! which receipt goes where); this module only checks and carries it out:
//! * every name in the plan is a single, safe file or folder name (no paths),
//! * the export folder is always new (`… (2)` if the name is taken), so nothing
//!   the user already has is overwritten,
//! * receipts are copied by attachment id (the frontend never passes a path into
//!   the app folder); a receipt whose file is missing is reported, not fatal,
//! * if anything else fails, the new folder is removed again.
//!
//! HomeBase gives no tax advice: the plan is what the user entered, grouped.
//!
//! Layers: `commands.rs` → this module → `workbook.rs` (xlsx) and
//! `crate::attachments` (files of the receipts).

mod workbook;

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};
use tauri_plugin_sql::DbInstances;

use crate::attachments::attachment_path;
use crate::error::CommandResult;

use self::workbook::{parse_sheet, write_workbook, Sheet};

/// How many `name (n)` folders are tried before giving up.
const MAX_FOLDER_ATTEMPTS: usize = 100;
/// Longer names are rejected (Windows paths get too long otherwise).
const MAX_NAME_LENGTH: usize = 120;

/// One receipt to copy: attachment `attachment_id` → `<folder>/<file_name>`.
struct Receipt {
    attachment_id: i64,
    folder: String,
    file_name: String,
}

/// What the frontend asks for (see `TaxExportPlan` in src/types/tax-export.ts).
pub(crate) struct ExportPlan {
    folder_name: String,
    workbook_name: String,
    currency_format: String,
    date_format: String,
    sheets: Vec<Sheet>,
    receipts: Vec<Receipt>,
}

pub(crate) fn invalid_plan() -> String {
    "The export could not be prepared (invalid data).".to_string()
}

pub(crate) fn text_field(object: &Value, key: &str) -> CommandResult<String> {
    object.get(key).and_then(Value::as_str).map(str::to_string).ok_or_else(invalid_plan)
}

pub(crate) fn array_field<'a>(object: &'a Value, key: &str) -> CommandResult<&'a Vec<Value>> {
    object.get(key).and_then(Value::as_array).ok_or_else(invalid_plan)
}

fn parse_receipt(value: &Value) -> CommandResult<Receipt> {
    Ok(Receipt {
        attachment_id: value.get("attachmentId").and_then(Value::as_i64).ok_or_else(invalid_plan)?,
        folder: text_field(value, "folder")?,
        file_name: text_field(value, "fileName")?,
    })
}

/// Reads the plan the frontend sent.
pub(crate) fn parse_plan(plan: &Value) -> CommandResult<ExportPlan> {
    Ok(ExportPlan {
        folder_name: text_field(plan, "folderName")?,
        workbook_name: text_field(plan, "workbookName")?,
        currency_format: text_field(plan, "currencyFormat")?,
        date_format: text_field(plan, "dateFormat")?,
        sheets: array_field(plan, "sheets")?.iter().map(parse_sheet).collect::<CommandResult<_>>()?,
        receipts: array_field(plan, "receipts")?.iter().map(parse_receipt).collect::<CommandResult<_>>()?,
    })
}

fn is_forbidden_char(c: char) -> bool {
    matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || c.is_control()
}

/// A single file or folder name that is valid on Windows, macOS and Linux and
/// can't point anywhere else (no separators, no `..`).
pub(crate) fn is_safe_name(name: &str) -> bool {
    !name.trim().is_empty()
        && name.chars().count() <= MAX_NAME_LENGTH
        && !name.starts_with('.')
        && !name.ends_with(['.', ' '])
        && !name.chars().any(is_forbidden_char)
}

/// Checks every name in the plan before anything is written.
fn check_names(plan: &ExportPlan) -> CommandResult<()> {
    let names = [&plan.folder_name, &plan.workbook_name]
        .into_iter()
        .chain(plan.receipts.iter().flat_map(|receipt| [&receipt.folder, &receipt.file_name]));
    for name in names {
        if !is_safe_name(name) {
            return Err(format!("The export contains an invalid file name: {name}"));
        }
    }
    if !plan.workbook_name.ends_with(".xlsx") {
        return Err(format!("The export contains an invalid file name: {}", plan.workbook_name));
    }
    Ok(())
}

/// Turns an I/O error into the message for `path`.
fn io_checked<T>(result: io::Result<T>, path: &Path) -> CommandResult<T> {
    match result {
        Ok(value) => Ok(value),
        Err(error) => Err(format!("Could not write {}: {error}", path.display())),
    }
}

/// Creates `parent/name`, or `parent/name (2)`, `(3)`, … if that exists. Never
/// writes into an existing folder.
fn create_unique_folder(parent: &Path, name: &str) -> CommandResult<PathBuf> {
    for attempt in 1..=MAX_FOLDER_ATTEMPTS {
        let candidate = match attempt {
            1 => parent.join(name),
            n => parent.join(format!("{name} ({n})")),
        };
        match fs::create_dir(&candidate) {
            Ok(()) => return Ok(candidate),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return io_checked(Err(error), &candidate),
        }
    }
    Err(format!("Could not create a new folder in {}: too many folders named {name}.", parent.display()))
}

/// What was copied: the number of files, and the receipts whose file is missing.
struct Copied {
    count: usize,
    missing: Vec<String>,
}

async fn copy_receipts(
    config_dir: &Path,
    instances: &DbInstances,
    folder: &Path,
    receipts: &[Receipt],
) -> CommandResult<Copied> {
    let mut copied = Copied { count: 0, missing: Vec::new() };
    for receipt in receipts {
        let target_dir = folder.join(&receipt.folder);
        io_checked(fs::create_dir_all(&target_dir), &target_dir)?;
        let target = target_dir.join(&receipt.file_name);
        match attachment_path(config_dir, instances, receipt.attachment_id).await {
            Ok(source) => {
                io_checked(fs::copy(&source, &target), &target)?;
                copied.count += 1;
            }
            Err(error) => {
                log::error!("Receipt {} not exported: {error}", receipt.attachment_id);
                copied.missing.push(format!("{}/{}", receipt.folder, receipt.file_name));
            }
        }
    }
    Ok(copied)
}

async fn fill_folder(
    config_dir: &Path,
    instances: &DbInstances,
    folder: &Path,
    plan: &ExportPlan,
) -> CommandResult<Copied> {
    let copied = copy_receipts(config_dir, instances, folder, &plan.receipts).await?;
    write_workbook(&folder.join(&plan.workbook_name), &plan.sheets, &plan.currency_format, &plan.date_format)?;
    Ok(copied)
}

/// Creates the export folder inside `directory` (picked by the user in a dialog).
/// Returns `{ folder, copied, missing }`: the folder's path, how many receipts were
/// copied, and the receipts (as `folder/file`) whose file is missing.
pub(crate) async fn export_tax_folder(
    config_dir: &Path,
    instances: &DbInstances,
    directory: &Path,
    plan: &Value,
) -> CommandResult<Value> {
    let plan = parse_plan(plan)?;
    check_names(&plan)?;
    let folder = create_unique_folder(directory, &plan.folder_name)?;
    match fill_folder(config_dir, instances, &folder, &plan).await {
        Ok(copied) => {
            log::info!("Tax export written: {} ({} receipts, {} missing)", folder.display(), copied.count, copied.missing.len());
            Ok(json!({ "folder": folder.display().to_string(), "copied": copied.count, "missing": copied.missing }))
        }
        Err(error) => {
            let _ = fs::remove_dir_all(&folder);
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests;
