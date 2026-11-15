//! HomeBase's native side.
//!
//! * `app` – Tauri builder, plugins and startup error handling (wiring only).
//! * `commands` – thin `#[tauri::command]` wrappers around `data_transfer`.
//! * `data_transfer`, `migrations`, `startup` – the actual logic, unit-tested.
//!
//! `app.rs`, `commands.rs` and `main.rs` contain only glue that needs a running
//! Tauri app, so they are excluded from the coverage gate (see `coverage:rust`
//! in package.json). Keep logic out of them.

mod app;
mod commands;
mod data_transfer;
mod migrations;
mod startup;

pub use app::run;

/// Connection string of the application database.
///
/// The SQL plugin resolves relative SQLite paths against the platform's
/// application directory (`%APPDATA%\com.homebase.desktop` on Windows,
/// see README → "Database location").
/// Must match `DATABASE_URL` in `src/services/database/database.service.ts`
/// and the `plugins.sql.preload` entry in `tauri.conf.json`.
pub const DATABASE_URL: &str = "sqlite:homebase.db";
