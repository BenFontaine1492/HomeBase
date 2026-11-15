//! Versioned database migrations.
//!
//! Rules:
//! * Never edit or delete a migration that has been released – add a new one.
//! * Versions must be unique and strictly increasing.
//! * Each migration runs inside a transaction (sqlx default), so a failing
//!   migration is rolled back and the database stays at the previous version.

use tauri_plugin_sql::{Migration, MigrationKind};

pub fn all() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_investments_table",
            sql: include_str!("../migrations/0001_create_investments_table.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_household_inventory",
            sql: include_str!("../migrations/0002_create_household_inventory.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqliteConnectOptions;
    use sqlx::{ConnectOptions, Connection};

    #[test]
    fn versions_start_at_1_and_strictly_increase() {
        let versions: Vec<i64> = all().iter().map(|m| m.version).collect();
        assert_eq!(versions.first(), Some(&1));
        assert!(versions.windows(2).all(|pair| pair[0] < pair[1]), "{versions:?}");
    }

    /// sqlx checksums the exact bytes, so a CRLF checkout would stop the app from starting.
    #[test]
    fn migration_files_use_lf_line_endings() {
        for migration in all() {
            assert!(!migration.sql.contains('\r'), "migration {} contains CRLF", migration.version);
        }
    }

    #[test]
    fn migrations_apply_to_an_empty_database_without_seed_data() {
        tauri::async_runtime::block_on(async {
            let mut conn = SqliteConnectOptions::new().in_memory(true).connect().await.unwrap();
            for migration in all() {
                sqlx::raw_sql(migration.sql).execute(&mut conn).await.unwrap();
            }

            let tables: Vec<String> = sqlx::query_scalar(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name",
            )
            .fetch_all(&mut conn)
            .await
            .unwrap();
            assert_eq!(tables, ["household_categories", "household_objects", "investments"]);

            for table in &tables {
                let rows: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
                    .fetch_one(&mut conn)
                    .await
                    .unwrap();
                assert_eq!(rows, 0, "{table} contains seed data");
            }
            conn.close().await.unwrap();
        });
    }
}
