//! Shared database access for every native module (the Rust repository layer's base).
//!
//! * [`live_pool`] – the pool the SQL plugin opened at startup.
//! * [`bind_json`] – binds a JSON value (from the frontend or an export) as an SQL parameter.
//! * [`execute_transaction`] – runs several statements in one transaction.
//!
//! The frontend's SQL plugin sends every call to any free connection of its
//! pool, so `BEGIN … COMMIT` spread over separate frontend calls is not
//! reliable. Writes that must succeed or fail together (e.g. an object and its
//! attributes) are sent to [`execute_transaction`] as one batch instead.
//!
//! The frontend may already run any statement through `sql:allow-execute`, so
//! that command grants no new access. SQL text comes from the frontend
//! repositories, values are always bound as parameters.

use serde_json::{json, Value};
use sqlx::Sqlite;
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::error::{error_text, CommandResult};
use crate::DATABASE_URL;

/// The pool the SQL plugin opened at startup (shared with the frontend).
#[allow(unreachable_patterns)] // `_` only matters if another sql driver feature is enabled
pub(crate) async fn live_pool(instances: &DbInstances) -> CommandResult<sqlx::Pool<Sqlite>> {
    let instances = instances.0.read().await;
    // `DbPool::sqlite()` is commented out in tauri-plugin-sql 2.6, so match the variant.
    match instances.get(DATABASE_URL) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        _ => Err("The database is not open.".to_string()),
    }
}

/// Binds `value` as the next parameter of `query`. `location` names it in the error
/// for values SQLite can't store (arrays, objects).
pub(crate) fn bind_json<'q>(
    query: sqlx::query::Query<'q, Sqlite, sqlx::sqlite::SqliteArguments<'q>>,
    value: &Value,
    location: &str,
) -> CommandResult<sqlx::query::Query<'q, Sqlite, sqlx::sqlite::SqliteArguments<'q>>> {
    Ok(match value {
        Value::Null => query.bind(None::<i64>),
        Value::Bool(flag) => query.bind(i64::from(*flag)),
        Value::Number(number) => match number.as_i64() {
            Some(integer) => query.bind(integer),
            // Not an i64, so a float: as_f64() is always Some without serde_json's
            // `arbitrary_precision` feature (which this app doesn't enable).
            None => query.bind(number.as_f64()),
        },
        Value::String(text) => query.bind(text.clone()),
        _ => return Err(format!("Unsupported value in {location}.")),
    })
}

/// One statement: SQL with `$1, $2, …` placeholders, and its parameter values.
/// Sent from the frontend as `[sql, [values…]]`.
pub(crate) type Statement = (String, Vec<Value>);

/// Runs `statements` in order inside one transaction. If any of them fails,
/// nothing is written. Returns `{ rowsAffected, lastInsertId }` per statement,
/// like the SQL plugin's `execute`.
pub(crate) async fn execute_transaction(instances: &DbInstances, statements: &[Statement]) -> CommandResult<Vec<Value>> {
    let pool = live_pool(instances).await?;
    let mut tx = pool.begin().await.map_err(error_text)?;
    let mut results = Vec::with_capacity(statements.len());
    for (index, (sql, params)) in statements.iter().enumerate() {
        let location = format!("statement {}", index + 1);
        let mut query = sqlx::query(sql);
        for value in params {
            query = bind_json(query, value, &location)?;
        }
        let result = query.execute(&mut *tx).await.map_err(error_text)?;
        results.push(json!({ "rowsAffected": result.rows_affected(), "lastInsertId": result.last_insert_rowid() }));
    }
    // Returning early above drops `tx`, which rolls everything back.
    tx.commit().await.map_err(error_text)?;
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::migrations;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

    type Pool = sqlx::Pool<sqlx::Sqlite>;

    fn run<F: std::future::Future>(future: F) -> F::Output {
        tauri::async_runtime::block_on(future)
    }

    /// A migrated in-memory database registered as the live one.
    /// One connection only: every connection to `:memory:` is a separate database.
    async fn live_database() -> (DbInstances, Pool) {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(SqliteConnectOptions::new().in_memory(true))
            .await
            .unwrap();
        for migration in migrations::all() {
            sqlx::raw_sql(migration.sql).execute(&pool).await.unwrap();
        }
        let instances = DbInstances::default();
        instances.0.write().await.insert(DATABASE_URL.to_string(), DbPool::Sqlite(pool.clone()));
        (instances, pool)
    }

    async fn count(pool: &Pool, table: &str) -> i64 {
        sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}")).fetch_one(pool).await.unwrap()
    }

    fn statement(sql: &str, params: Vec<Value>) -> Statement {
        (sql.to_string(), params)
    }

    fn insert_object(name: &str) -> Statement {
        statement("INSERT INTO household_objects (name) VALUES ($1)", vec![json!(name)])
    }

    /// Refers to the object inserted earlier in the same transaction.
    fn insert_attribute(name: &str) -> Statement {
        statement(
            "INSERT INTO household_object_attributes (household_object_id, name, value_type, value)
             VALUES ((SELECT max(id) FROM household_objects), $1, 'text', $2)",
            vec![json!(name), Value::Null],
        )
    }

    #[test]
    fn runs_all_statements_and_reports_their_results() {
        run(async {
            let (instances, pool) = live_database().await;
            let results = execute_transaction(
                &instances,
                &[insert_object("Heat pump"), insert_attribute("Power"), insert_attribute("Refrigerant")],
            )
            .await
            .unwrap();

            assert_eq!(results[0], json!({ "rowsAffected": 1, "lastInsertId": 1 }));
            assert_eq!(results[2], json!({ "rowsAffected": 1, "lastInsertId": 2 }));
            assert_eq!(count(&pool, "household_object_attributes").await, 2);
            pool.close().await;
        });
    }

    #[test]
    fn writes_nothing_when_a_later_statement_fails() {
        run(async {
            let (instances, pool) = live_database().await;
            // Same name twice on one object violates the UNIQUE constraint.
            let error = execute_transaction(
                &instances,
                &[insert_object("Heat pump"), insert_attribute("Power"), insert_attribute("power")],
            )
            .await
            .unwrap_err();

            assert!(error.contains("UNIQUE constraint failed"), "{error}");
            assert_eq!(count(&pool, "household_objects").await, 0);
            assert_eq!(count(&pool, "household_object_attributes").await, 0);
            pool.close().await;
        });
    }

    #[test]
    fn rejects_unsupported_parameter_values() {
        run(async {
            let (instances, pool) = live_database().await;
            let error = execute_transaction(
                &instances,
                &[insert_object("ok"), statement("SELECT $1", vec![json!(["a"])])],
            )
            .await
            .unwrap_err();

            assert_eq!(error, "Unsupported value in statement 2.");
            assert_eq!(count(&pool, "household_objects").await, 0);
            pool.close().await;
        });
    }

    #[test]
    fn needs_an_open_database() {
        run(async {
            let error = execute_transaction(&DbInstances::default(), &[]).await.unwrap_err();
            assert_eq!(error, "The database is not open.");
        });
    }
}
