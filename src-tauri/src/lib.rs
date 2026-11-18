//! HomeBase's native side.
//!
//! Layers (controller → service → repository):
//! * `app` – Tauri builder, plugins and startup error handling (wiring only).
//! * `commands` – controllers: thin `#[tauri::command]` wrappers.
//! * `data_transfer` – service (rules, file handling) with its `repository` (SQL).
//! * `attachments` – the files of documents in `attachments/` (service + `repository`).
//! * `db` – shared database access (live pool, value binding, transactions).
//! * `error`, `migrations`, `startup` – result type, schema, startup error text.
//!
//! Everything except `app`, `commands` and `main` is unit-tested.
//!
//! `app.rs`, `commands.rs` and `main.rs` contain only glue that needs a running
//! Tauri app, so they are excluded from the coverage gate (see `coverage:rust`
//! in package.json). Keep logic out of them.

mod app;
mod attachments;
mod commands;
mod data_transfer;
mod db;
mod error;
mod migrations;
mod startup;
#[cfg(test)]
mod test_support;

pub use app::run;

/// Connection string of the application database.
///
/// The SQL plugin resolves relative SQLite paths against the platform's
/// application directory (`%APPDATA%\com.homebase.desktop` on Windows,
/// see README → "Database location").
/// Must match `DATABASE_URL` in `src/infrastructure/database.ts`
/// and the `plugins.sql.preload` entry in `tauri.conf.json`.
pub const DATABASE_URL: &str = "sqlite:homebase.db";
