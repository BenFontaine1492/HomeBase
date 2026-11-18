//! Tests for the attachments service and its repository: real files in a
//! temporary folder, rows in an in-memory database.
//!
//! Coverage is measured on test code too, so avoid branches that never run.

use std::fs;
use std::time::Duration;

use super::*;
use crate::test_support::{memory_database, run, Pool, TestDir};

const ONE_HOUR: Duration = Duration::from_secs(3600);

/// One object with an attachment row for each of `stored_names`.
async fn attachment_rows(pool: &Pool, stored_names: &[&str]) {
    sqlx::query("INSERT INTO household_objects (id, name) VALUES (1, 'Heat pump')")
        .execute(pool)
        .await
        .unwrap();
    for name in stored_names {
        sqlx::query(
            "INSERT INTO attachments (household_object_id, stored_name, original_name, mime_type, size_bytes, document_type)
             VALUES (1, $1, 'invoice.pdf', 'application/pdf', 1, 'invoice')",
        )
        .bind(name)
        .execute(pool)
        .await
        .unwrap();
    }
}

/// Writes `files` (names) into `dir`, creating it.
fn write_files(dir: &Path, files: &[&str]) {
    fs::create_dir_all(dir).unwrap();
    for name in files {
        fs::write(dir.join(name), name).unwrap();
    }
}

/// The file names in `dir`, sorted; empty if it doesn't exist.
fn names_in(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    names
}

#[test]
fn stored_names_keep_only_simple_extensions() {
    assert_eq!(stored_extension(Path::new("Invoice.PDF")), ".pdf");
    assert_eq!(stored_extension(Path::new("archive.tar.gz")), ".gz");
    for unusual in ["no-extension", "photo.jpé", "file.averyverylongext", "file.p-f", "trailing."] {
        assert_eq!(stored_extension(Path::new(unusual)), "", "{unusual}");
    }
}

#[test]
fn only_plain_file_names_are_valid_stored_names() {
    assert!(is_valid_stored_name("18f3a2b4-0.pdf"));
    for invalid in ["", ".hidden", "..", "../secret.txt", "a/b.pdf", "a\\b.pdf", "C:x.pdf", "a b.pdf"] {
        assert!(!is_valid_stored_name(invalid), "{invalid}");
    }
}

#[test]
fn unique_files_never_replace_an_existing_one() {
    let dir = TestDir::new();
    write_files(&dir.0, &["ff-0.pdf", "ff-1.pdf"]);

    let (name, _file) = create_unique_file(&dir.0, 0xff, ".pdf").unwrap();

    assert_eq!(name, "ff-2.pdf");
    assert_eq!(fs::read_to_string(dir.path("ff-0.pdf")).unwrap(), "ff-0.pdf");
    let error = create_unique_file(&dir.path("missing"), 1, "").unwrap_err();
    assert!(error.starts_with("Could not store the file in"), "{error}");
}

#[test]
fn stores_a_copy_under_a_new_name() {
    let dir = TestDir::new();
    let source = dir.path("Rechnung Wärmepumpe.PDF");
    fs::write(&source, "hello").unwrap();

    let stored = store_file(&dir.0, &source).unwrap();

    let stored_name = stored["storedName"].as_str().unwrap();
    assert!(is_valid_stored_name(stored_name) && stored_name.ends_with("-0.pdf"), "{stored_name}");
    assert_eq!(stored["originalName"], "Rechnung Wärmepumpe.PDF");
    assert_eq!(stored["sizeBytes"], 5);
    assert_eq!(fs::read_to_string(attachments_dir(&dir.0).join(stored_name)).unwrap(), "hello");
    assert!(source.is_file(), "the original stays where it was");
}

#[test]
fn storing_reports_sources_and_folders_that_cannot_be_used() {
    let dir = TestDir::new();
    let missing = store_file(&dir.0, &dir.path("missing.pdf")).unwrap_err();
    assert!(missing.starts_with("File not found"), "{missing}");

    // A folder can't be copied; the reserved file is removed again.
    let folder = dir.path("folder.pdf");
    fs::create_dir(&folder).unwrap();
    let not_a_file = store_file(&dir.0, &folder).unwrap_err();
    assert!(not_a_file.starts_with("Could not copy"), "{not_a_file}");
    assert!(names_in(&attachments_dir(&dir.0)).is_empty());

    // The app data folder is a file, so attachments/ can't be created in it.
    let blocked = dir.path("blocked");
    fs::write(&blocked, "").unwrap();
    let no_folder = store_file(&blocked, &blocked).unwrap_err();
    assert!(no_folder.starts_with("Could not create"), "{no_folder}");
}

#[test]
fn resolves_an_attachment_to_its_file() {
    run(async {
        let dir = TestDir::new();
        let (instances, pool) = memory_database().await;
        attachment_rows(&pool, &["present.pdf", "missing.pdf", "../escape.pdf"]).await;
        write_files(&attachments_dir(&dir.0), &["present.pdf"]);

        assert_eq!(attachment_path(&dir.0, &instances, 1).await.unwrap(), attachments_dir(&dir.0).join("present.pdf"));
        let missing = attachment_path(&dir.0, &instances, 2).await.unwrap_err();
        assert!(missing.starts_with("The file of this document is missing."), "{missing}");
        let escape = attachment_path(&dir.0, &instances, 3).await.unwrap_err();
        assert_eq!(escape, "This document has an invalid file name.");
        let unknown = attachment_path(&dir.0, &instances, 99).await.unwrap_err();
        assert_eq!(unknown, "This document no longer exists.");
        pool.close().await;
    });
}

#[test]
fn removes_only_old_files_without_a_row() {
    run(async {
        let dir = TestDir::new();
        let (instances, pool) = memory_database().await;
        // No attachments/ folder yet: nothing to do.
        assert_eq!(remove_orphans(&dir.0, &instances, Duration::ZERO).await.unwrap(), 0);

        attachment_rows(&pool, &["kept.pdf"]).await;
        let folder = attachments_dir(&dir.0);
        write_files(&folder, &["kept.pdf", "orphan.pdf"]);
        fs::create_dir(folder.join("subfolder")).unwrap();

        // Just written, so possibly still being added: kept.
        assert_eq!(remove_orphans(&dir.0, &instances, ONE_HOUR).await.unwrap(), 0);
        assert_eq!(remove_orphans(&dir.0, &instances, Duration::ZERO).await.unwrap(), 1);
        assert_eq!(names_in(&folder), ["kept.pdf", "subfolder"]);
        pool.close().await;
    });
}

#[test]
fn orphan_cleanup_reports_an_unreadable_folder_and_a_closed_database() {
    run(async {
        let dir = TestDir::new();
        let (instances, pool) = memory_database().await;
        fs::write(attachments_dir(&dir.0), "not a folder").unwrap();

        let error = remove_orphans(&dir.0, &instances, Duration::ZERO).await.unwrap_err();
        assert!(error.starts_with("Could not read"), "{error}");
        let closed = remove_orphans(&dir.0, &DbInstances::default(), Duration::ZERO).await.unwrap_err();
        assert_eq!(closed, "The database is not open.");
        pool.close().await;
    });
}

#[test]
fn sets_aside_unused_files_and_takes_back_files_the_data_uses_again() {
    run(async {
        let dir = TestDir::new();
        let (_instances, pool) = memory_database().await;
        attachment_rows(&pool, &["used.pdf", "back.pdf"]).await;
        let folder = attachments_dir(&dir.0);
        write_files(&folder, &["used.pdf", "unused.pdf"]);
        // Set aside by an earlier import, but used by the data again (an undone restore).
        write_files(&dir.path(BEFORE_IMPORT_FOLDER), &["back.pdf"]);
        // Left from an earlier restore: replaced.
        write_files(&dir.path(BEFORE_RESTORE_FOLDER), &["older.pdf"]);

        assert_eq!(set_aside_orphans(&dir.0, &pool, BEFORE_RESTORE_FOLDER).await.unwrap(), 1);

        assert_eq!(names_in(&folder), ["back.pdf", "used.pdf"]);
        assert_eq!(names_in(&dir.path(BEFORE_RESTORE_FOLDER)), ["unused.pdf"]);
        assert!(names_in(&dir.path(BEFORE_IMPORT_FOLDER)).is_empty());
        // Nothing unused: nothing to move, no folder needed.
        assert_eq!(set_aside_orphans(&dir.0, &pool, BEFORE_IMPORT_FOLDER).await.unwrap(), 0);
        pool.close().await;
    });
}

#[test]
fn setting_aside_reports_a_folder_that_cannot_be_created() {
    run(async {
        let dir = TestDir::new();
        let (_instances, pool) = memory_database().await;
        attachment_rows(&pool, &["back.pdf"]).await;
        write_files(&dir.path(BEFORE_IMPORT_FOLDER), &["back.pdf"]);
        // attachments/ is a file, so the used file can't be moved back.
        fs::write(attachments_dir(&dir.0), "a file in the way").unwrap();

        let error = set_aside_orphans(&dir.0, &pool, BEFORE_RESTORE_FOLDER).await.unwrap_err();

        assert!(error.starts_with("Could not create"), "{error}");
        assert_eq!(names_in(&dir.path(BEFORE_IMPORT_FOLDER)), ["back.pdf"]);
        pool.close().await;
    });
}
