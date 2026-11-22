use std::fs;

use serde_json::{json, Value};

use super::workbook::parse_cell;
use super::*;
use crate::attachments::attachments_dir;
use crate::test_support::{memory_database, run, TestDir};

fn sheet(name: &str) -> Value {
    json!({
        "name": name,
        "title": ["Ausgaben 2026", "Erstellt mit HomeBase"],
        "columns": [
            { "label": "Nr.", "width": 6 },
            { "label": "Datum", "width": 12 },
            { "label": "Beschreibung", "width": 30 },
            { "label": "Betrag", "width": 14 },
            { "label": "Beleg", "width": 40 },
        ],
        "rows": [
            [{ "number": 1 }, { "date": "2026-03-02" }, "Maler", { "amount": 50000 },
             { "link": "Handwerkerleistungen/001_2026-03-02_Maler.pdf", "text": "001_2026-03-02_Maler.pdf" }],
            [{ "number": 2 }, { "date": "2026-05-10" }, "Spende", { "amount": 2500 }, "kein Beleg"],
        ],
        "footer": [[null, null, "Summe", { "amount": 52500 }, null]],
    })
}

fn plan(sheet_name: &str, receipts: Value) -> Value {
    json!({
        "folderName": "HomeBase Steuer 2026",
        "workbookName": "Ausgaben 2026.xlsx",
        "currencyFormat": "#,##0.00 \"€\"",
        "dateFormat": "dd.mm.yyyy",
        "sheets": [sheet(sheet_name), sheet("Summen")],
        "receipts": receipts,
    })
}

fn receipt(id: i64, folder: &str, file_name: &str) -> Value {
    json!({ "attachmentId": id, "folder": folder, "fileName": file_name })
}

#[test]
fn accepts_only_single_safe_names() {
    for name in ["Ausgaben 2026.xlsx", "001_2026-03-02_Malerbetrieb Müller.pdf", "Arbeitszimmer – Homeoffice"] {
        assert!(is_safe_name(name), "{name}");
    }
    let too_long = "a".repeat(MAX_NAME_LENGTH + 1);
    for name in ["", "  ", "..", ".hidden", "a.", "a ", "a/b", r"a\b", "C:", "a*", "a?", "a\"", "<a>", "a|b", "a\nb", &too_long] {
        assert!(!is_safe_name(name), "{name:?}");
    }
}

#[test]
fn checks_every_name_of_the_plan() {
    let valid = parse_plan(&plan("Ausgaben", json!([receipt(1, "Spenden", "001.pdf")]))).unwrap();
    assert_eq!(check_names(&valid), Ok(()));

    let mut bad_receipt = plan("Ausgaben", json!([receipt(1, "..", "001.pdf")]));
    let error = check_names(&parse_plan(&bad_receipt).unwrap()).unwrap_err();
    assert_eq!(error, "The export contains an invalid file name: ..");
    bad_receipt["receipts"] = json!([receipt(1, "Spenden", "a/b.pdf")]);
    assert!(check_names(&parse_plan(&bad_receipt).unwrap()).is_err());

    let mut not_xlsx = plan("Ausgaben", json!([]));
    not_xlsx["workbookName"] = json!("Ausgaben.csv");
    let error = check_names(&parse_plan(&not_xlsx).unwrap()).unwrap_err();
    assert_eq!(error, "The export contains an invalid file name: Ausgaben.csv");
}

#[test]
fn rejects_malformed_plans() {
    let invalid = invalid_plan();
    let mut cases = Vec::new();
    for key in ["folderName", "workbookName", "currencyFormat", "dateFormat", "sheets", "receipts"] {
        let mut broken = plan("A", json!([]));
        broken.as_object_mut().unwrap().remove(key);
        cases.push(broken);
    }
    let mut bad_receipt = plan("A", json!([{ "attachmentId": "1", "folder": "a", "fileName": "b" }]));
    cases.push(bad_receipt.clone());
    bad_receipt["receipts"] = json!([{ "attachmentId": 1, "folder": "a" }]);
    cases.push(bad_receipt);
    let mut bad_sheet = plan("A", json!([]));
    bad_sheet["sheets"][0]["title"] = json!([1]);
    cases.push(bad_sheet.clone());
    bad_sheet["sheets"][0] = json!({ "name": "A", "title": [], "columns": [{ "label": "x" }], "rows": [], "footer": [] });
    cases.push(bad_sheet.clone());
    bad_sheet["sheets"][0] = json!({ "name": "A", "title": [], "columns": [], "rows": ["not a row"], "footer": [] });
    cases.push(bad_sheet);
    for case in cases {
        assert_eq!(parse_plan(&case).err(), Some(invalid.clone()), "{case}");
    }
}

#[test]
fn parses_every_kind_of_cell() {
    let invalid = invalid_plan();
    for cell in [json!(null), json!("x"), json!({ "number": 1.5 }), json!({ "amount": 5 }), json!({ "date": "2026-01-31" })] {
        assert!(parse_cell(&cell).is_ok(), "{cell}");
    }
    assert!(parse_cell(&json!({ "link": "a/b.pdf", "text": "b.pdf" })).is_ok());
    let bad = [
        json!(1),
        json!(true),
        json!({ "amount": 1.5 }),
        json!({ "number": "1" }),
        json!({ "date": 20260101 }),
        json!({ "date": "31.01.2026" }),
        json!({ "link": "a" }),
        json!({}),
    ];
    for cell in bad {
        assert_eq!(parse_cell(&cell).err(), Some(invalid.clone()), "{cell}");
    }
}

#[test]
fn creates_a_new_folder_and_never_reuses_one() {
    let dir = TestDir::new();
    let first = create_unique_folder(&dir.0, "Export").unwrap();
    let second = create_unique_folder(&dir.0, "Export").unwrap();
    assert_eq!(first, dir.path("Export"));
    assert_eq!(second, dir.path("Export (2)"));

    for n in 3..=MAX_FOLDER_ATTEMPTS {
        fs::create_dir(dir.path(&format!("Full ({n})"))).unwrap();
    }
    fs::create_dir(dir.path("Full")).unwrap();
    fs::create_dir(dir.path("Full (2)")).unwrap();
    let error = create_unique_folder(&dir.0, "Full").unwrap_err();
    assert!(error.contains("too many folders named Full"), "{error}");

    let error = create_unique_folder(&dir.path("missing"), "Export").unwrap_err();
    assert!(error.starts_with("Could not write"), "{error}");
}

#[test]
fn reports_io_errors_with_the_path() {
    let error = io_checked::<()>(Err(io::Error::other("disk full")), Path::new("x.xlsx")).unwrap_err();
    assert_eq!(error, "Could not write x.xlsx: disk full");
}

/// A cost with two receipt rows; only the file of the first one exists.
async fn database_with_receipts(config_dir: &Path) -> DbInstances {
    let (instances, pool) = memory_database().await;
    sqlx::raw_sql(
        "INSERT INTO costs (id, paid_date, amount_cents, cost_type, description) VALUES (1, '2026-03-02', 50000, 'repair', 'Maler');
         INSERT INTO attachments (id, cost_id, stored_name, original_name, mime_type, size_bytes, document_type)
         VALUES (1, 1, 'ff-0.pdf', 'Rechnung.pdf', 'application/pdf', 7, 'invoice'),
                (2, 1, 'ff-1.pdf', 'Quittung.pdf', 'application/pdf', 7, 'receipt')",
    )
    .execute(&pool)
    .await
    .unwrap();
    fs::create_dir_all(attachments_dir(config_dir)).unwrap();
    fs::write(attachments_dir(config_dir).join("ff-0.pdf"), "invoice").unwrap();
    instances
}

#[test]
fn writes_the_workbook_and_copies_the_receipts() {
    run(async {
        let config = TestDir::new();
        let target = TestDir::new();
        let instances = database_with_receipts(&config.0).await;
        let receipts = json!([
            receipt(1, "Handwerkerleistungen", "001_2026-03-02_Maler.pdf"),
            receipt(2, "Handwerkerleistungen", "001_2026-03-02_Maler_2.pdf"),
            receipt(99, "Spenden", "002_2026-05-10_Spende.pdf"),
        ]);

        let result = export_tax_folder(&config.0, &instances, &target.0, &plan("Ausgaben 2026", receipts)).await.unwrap();

        let folder = target.path("HomeBase Steuer 2026");
        assert_eq!(result["folder"], json!(folder.display().to_string()));
        assert_eq!(result["copied"], json!(1));
        assert_eq!(
            result["missing"],
            json!(["Handwerkerleistungen/001_2026-03-02_Maler_2.pdf", "Spenden/002_2026-05-10_Spende.pdf"])
        );
        let copy = fs::read_to_string(folder.join("Handwerkerleistungen").join("001_2026-03-02_Maler.pdf")).unwrap();
        assert_eq!(copy, "invoice");
        // An .xlsx file is a zip archive.
        let workbook = fs::read(folder.join("Ausgaben 2026.xlsx")).unwrap();
        assert_eq!(&workbook[..2], b"PK");

        let again = export_tax_folder(&config.0, &instances, &target.0, &plan("Ausgaben 2026", json!([]))).await.unwrap();
        assert_eq!(again["folder"], json!(target.path("HomeBase Steuer 2026 (2)").display().to_string()));
    });
}

#[test]
fn removes_the_new_folder_when_the_export_fails() {
    run(async {
        let config = TestDir::new();
        let target = TestDir::new();
        let instances = database_with_receipts(&config.0).await;
        let receipts = json!([receipt(1, "Spenden", "001.pdf")]);

        // Excel doesn't allow '/' in sheet names.
        let error = export_tax_folder(&config.0, &instances, &target.0, &plan("a/b", receipts)).await.unwrap_err();

        assert!(error.starts_with("Could not write the workbook"), "{error}");
        assert!(!target.path("HomeBase Steuer 2026").exists());
        let unsafe_plan = plan("A", json!([receipt(1, "..", "x")]));
        assert!(export_tax_folder(&config.0, &instances, &target.0, &unsafe_plan).await.is_err());
        assert!(!target.path("HomeBase Steuer 2026").exists());
    });
}

#[test]
fn fails_when_a_receipt_cannot_be_copied() {
    run(async {
        let config = TestDir::new();
        let target = TestDir::new();
        let instances = database_with_receipts(&config.0).await;
        // A folder named like the target file makes the copy fail.
        let receipts = json!([receipt(1, "Spenden", "001.pdf")]);
        let folder = target.path("HomeBase Steuer 2026");
        let plan = plan("Ausgaben", receipts);
        let parsed = parse_plan(&plan).unwrap();
        fs::create_dir_all(folder.join("Spenden").join("001.pdf")).unwrap();

        let error = copy_receipts(&config.0, &instances, &folder, &parsed.receipts).await.err().unwrap();

        assert!(error.starts_with("Could not write"), "{error}");
    });
}
