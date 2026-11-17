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
        Migration {
            version: 3,
            description: "create_household_object_attributes",
            sql: include_str!("../migrations/0003_create_household_object_attributes.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// Highest migration version this build of the app knows.
pub(crate) fn app_schema_version() -> i64 {
    all().iter().map(|m| m.version).max().unwrap_or(0)
}

/// The migrations as sqlx sees them (same conversion as tauri-plugin-sql, so
/// versions and checksums match what the plugin records). Used to migrate a
/// restored backup and to compare a backup's checksums with this build.
pub(crate) fn app_migrations() -> Vec<sqlx::migrate::Migration> {
    all()
        .into_iter()
        .map(|m| {
            sqlx::migrate::Migration::new(
                m.version,
                m.description.into(),
                sqlx::migrate::MigrationType::ReversibleUp,
                m.sql.into(),
                false,
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqliteConnectOptions;
    use sqlx::{ConnectOptions, Connection};

    #[test]
    fn knows_the_latest_schema_version() {
        assert_eq!(app_schema_version(), all().last().unwrap().version);
        assert_eq!(app_migrations().len(), all().len());
    }

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
            assert_eq!(
                tables,
                ["household_categories", "household_object_attributes", "household_objects", "investments"]
            );

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

    /// Attribute names are unique per object (ignoring case) and go away with their object.
    #[test]
    fn object_attributes_are_unique_per_object_and_deleted_with_it() {
        tauri::async_runtime::block_on(async {
            // sqlx enables foreign keys by default, like the SQL plugin's pool.
            let mut conn = SqliteConnectOptions::new().in_memory(true).connect().await.unwrap();
            for migration in all() {
                sqlx::raw_sql(migration.sql).execute(&mut conn).await.unwrap();
            }
            let attribute = "INSERT INTO household_object_attributes (household_object_id, name, value_type, value, unit)
                             VALUES ($1, $2, 'number', '12.5', 'kW')";
            sqlx::raw_sql("INSERT INTO household_objects (id, name) VALUES (1, 'Heat pump'), (2, 'Boiler')")
                .execute(&mut conn)
                .await
                .unwrap();
            for (object, name) in [(1, "Power"), (2, "Power")] {
                sqlx::query(attribute).bind(object).bind(name).execute(&mut conn).await.unwrap();
            }

            let duplicate = sqlx::query(attribute).bind(1).bind("POWER").execute(&mut conn).await;
            assert!(duplicate.unwrap_err().to_string().contains("UNIQUE constraint failed"));
            let unknown_type = sqlx::raw_sql(
                "INSERT INTO household_object_attributes (household_object_id, name, value_type) VALUES (1, 'x', 'colour')",
            )
            .execute(&mut conn)
            .await;
            assert!(unknown_type.unwrap_err().to_string().contains("CHECK constraint failed"));

            sqlx::raw_sql("DELETE FROM household_objects WHERE id = 1").execute(&mut conn).await.unwrap();
            let remaining: Vec<i64> = sqlx::query_scalar("SELECT household_object_id FROM household_object_attributes")
                .fetch_all(&mut conn)
                .await
                .unwrap();
            assert_eq!(remaining, [2]);
            conn.close().await.unwrap();
        });
    }
}
