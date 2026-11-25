//! The summary workbook of a tax export (`.xlsx`, written by rust_xlsxwriter).
//!
//! Each sheet: title lines, an empty row, the header row (frozen), the rows, then
//! the footer rows in bold (e.g. the total). Cells come from the frontend as JSON:
//! `null` (empty), a string (text), `{ "number": 3 }`, `{ "amount": 12345 }`
//! (cents, shown in the currency format), `{ "date": "2026-03-02" }` or
//! `{ "link": "Spenden/004_….pdf", "text": "…" }` (a link to a file in the export
//! folder, relative to the workbook).

use std::path::Path;

use rust_xlsxwriter::{ExcelDateTime, Format, FormatAlign, FormatBorder, Url, Workbook, Worksheet, XlsxError};
use serde_json::Value;

use super::{array_field, invalid_plan, text_field};
use crate::error::CommandResult;

pub(super) enum Cell {
    Empty,
    Text(String),
    Number(f64),
    /// Integer cents.
    Amount(i64),
    Date(ExcelDateTime),
    Link { target: String, text: String },
}

pub(super) struct Column {
    label: String,
    width: f64,
}

pub(super) struct Sheet {
    name: String,
    title: Vec<String>,
    columns: Vec<Column>,
    rows: Vec<Vec<Cell>>,
    footer: Vec<Vec<Cell>>,
}

fn invalid_date(_: XlsxError) -> String {
    invalid_plan()
}

fn parse_object_cell(value: &Value) -> CommandResult<Cell> {
    if let Some(cents) = value.get("amount") {
        return cents.as_i64().map(Cell::Amount).ok_or_else(invalid_plan);
    }
    if let Some(number) = value.get("number") {
        return number.as_f64().map(Cell::Number).ok_or_else(invalid_plan);
    }
    if let Some(date) = value.get("date") {
        let text = date.as_str().ok_or_else(invalid_plan)?;
        return ExcelDateTime::parse_from_str(text).map(Cell::Date).map_err(invalid_date);
    }
    Ok(Cell::Link { target: text_field(value, "link")?, text: text_field(value, "text")? })
}

pub(super) fn parse_cell(value: &Value) -> CommandResult<Cell> {
    match value {
        Value::Null => Ok(Cell::Empty),
        Value::String(text) => Ok(Cell::Text(text.clone())),
        Value::Object(_) => parse_object_cell(value),
        _ => Err(invalid_plan()),
    }
}

fn parse_row(value: &Value) -> CommandResult<Vec<Cell>> {
    value.as_array().ok_or_else(invalid_plan)?.iter().map(parse_cell).collect()
}

fn parse_rows(sheet: &Value, key: &str) -> CommandResult<Vec<Vec<Cell>>> {
    array_field(sheet, key)?.iter().map(parse_row).collect()
}

fn parse_column(value: &Value) -> CommandResult<Column> {
    Ok(Column {
        label: text_field(value, "label")?,
        width: value.get("width").and_then(Value::as_f64).ok_or_else(invalid_plan)?,
    })
}

pub(super) fn parse_sheet(value: &Value) -> CommandResult<Sheet> {
    let title = array_field(value, "title")?
        .iter()
        .map(|line| line.as_str().map(str::to_string).ok_or_else(invalid_plan))
        .collect::<CommandResult<_>>()?;
    Ok(Sheet {
        name: text_field(value, "name")?,
        title,
        columns: array_field(value, "columns")?.iter().map(parse_column).collect::<CommandResult<_>>()?,
        rows: parse_rows(value, "rows")?,
        footer: parse_rows(value, "footer")?,
    })
}

/// The cell formats of a workbook.
struct Formats {
    title: Format,
    header: Format,
    text: Format,
    text_bold: Format,
    amount: Format,
    amount_bold: Format,
    date: Format,
}

impl Formats {
    fn new(currency_format: &str, date_format: &str) -> Self {
        let cell = Format::new().set_align(FormatAlign::Top);
        Self {
            title: Format::new().set_bold().set_font_size(14),
            header: Format::new().set_bold().set_border_bottom(FormatBorder::Thin).set_text_wrap(),
            text: cell.clone().set_text_wrap(),
            text_bold: cell.clone().set_text_wrap().set_bold(),
            amount: cell.clone().set_num_format(currency_format),
            amount_bold: cell.clone().set_num_format(currency_format).set_bold(),
            date: cell.set_num_format(date_format),
        }
    }
}

fn write_row(sheet: &mut Worksheet, row: u32, cells: &[Cell], formats: &Formats, bold: bool) -> Result<(), XlsxError> {
    let (text, amount) = if bold { (&formats.text_bold, &formats.amount_bold) } else { (&formats.text, &formats.amount) };
    for (col, cell) in (0u16..).zip(cells) {
        match cell {
            Cell::Empty => {}
            Cell::Text(value) => {
                sheet.write_string_with_format(row, col, value, text)?;
            }
            Cell::Number(value) => {
                sheet.write_number_with_format(row, col, *value, text)?;
            }
            Cell::Amount(cents) => {
                // Cents fit into an f64 exactly (they are far below 2^53).
                #[allow(clippy::cast_precision_loss)]
                sheet.write_number_with_format(row, col, *cents as f64 / 100.0, amount)?;
            }
            Cell::Date(date) => {
                sheet.write_datetime_with_format(row, col, date, &formats.date)?;
            }
            Cell::Link { target, text: label } => {
                sheet.write_url_with_text(row, col, Url::new(format!("file:///{target}")), label)?;
            }
        }
    }
    Ok(())
}

fn write_sheet(sheet: &mut Worksheet, data: &Sheet, formats: &Formats) -> Result<(), XlsxError> {
    sheet.set_name(&data.name)?;
    let mut row: u32 = 0;
    for line in &data.title {
        let format = if row == 0 { &formats.title } else { &formats.text };
        sheet.write_string_with_format(row, 0, line, format)?;
        row += 1;
    }
    // One empty row between the title and the table.
    row += u32::from(!data.title.is_empty());
    for (col, column) in (0u16..).zip(&data.columns) {
        sheet.set_column_width(col, column.width)?;
        sheet.write_string_with_format(row, col, &column.label, &formats.header)?;
    }
    sheet.set_freeze_panes(row + 1, 0)?;
    for cells in &data.rows {
        row += 1;
        write_row(sheet, row, cells, formats, false)?;
    }
    for cells in &data.footer {
        row += 1;
        write_row(sheet, row, cells, formats, true)?;
    }
    Ok(())
}

fn xlsx_error(error: XlsxError) -> String {
    format!("Could not write the workbook: {error}")
}

/// Writes `sheets` into a new workbook at `path`.
pub(super) fn write_workbook(path: &Path, sheets: &[Sheet], currency_format: &str, date_format: &str) -> CommandResult<()> {
    let formats = Formats::new(currency_format, date_format);
    let mut workbook = Workbook::new();
    for data in sheets {
        write_sheet(workbook.add_worksheet(), data, &formats).map_err(xlsx_error)?;
    }
    workbook.save(path).map_err(xlsx_error)
}
