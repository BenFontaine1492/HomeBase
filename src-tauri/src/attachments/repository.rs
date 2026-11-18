//! SQL of the attachments module. The frontend writes the `attachments` rows;
//! the native side only reads which files they refer to.

use std::collections::HashSet;

use sqlx::Sqlite;

use crate::error::{error_text, CommandResult};

/// The file name of attachment `id` inside `attachments/`; None = no such attachment.
pub(super) async fn stored_name_of(pool: &sqlx::Pool<Sqlite>, id: i64) -> CommandResult<Option<String>> {
    sqlx::query_scalar("SELECT stored_name FROM attachments WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(error_text)
}

/// Every file name an attachment row refers to.
pub(super) async fn all_stored_names(pool: &sqlx::Pool<Sqlite>) -> CommandResult<HashSet<String>> {
    let names: Vec<String> = sqlx::query_scalar("SELECT stored_name FROM attachments")
        .fetch_all(pool)
        .await
        .map_err(error_text)?;
    Ok(names.into_iter().collect())
}
