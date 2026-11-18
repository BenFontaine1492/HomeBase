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
        Migration {
            version: 4,
            description: "create_maintenance",
            sql: include_str!("../migrations/0004_create_maintenance.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create_attachments",
            sql: include_str!("../migrations/0005_create_attachments.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create_settings",
            sql: include_str!("../migrations/0006_create_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "create_dashboard_widgets",
            sql: include_str!("../migrations/0007_create_dashboard_widgets.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "extend_investments",
            sql: include_str!("../migrations/0008_extend_investments.sql"),
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

    /// An in-memory database with every migration applied.
    /// sqlx enables foreign keys by default, like the SQL plugin's pool.
    async fn migrated_connection() -> sqlx::SqliteConnection {
        let mut conn = SqliteConnectOptions::new().in_memory(true).connect().await.unwrap();
        for migration in all() {
            sqlx::raw_sql(migration.sql).execute(&mut conn).await.unwrap();
        }
        conn
    }

    /// Runs `sql`; the error as text, for `contains` checks.
    async fn run_sql(conn: &mut sqlx::SqliteConnection, sql: &str) -> Result<(), String> {
        sqlx::raw_sql(sql).execute(conn).await.map(drop).map_err(crate::error::error_text)
    }

    async fn ids(conn: &mut sqlx::SqliteConnection, sql: &str) -> Vec<Option<i64>> {
        sqlx::query_scalar(sql).fetch_all(conn).await.unwrap()
    }

    /// Only the dashboard has seed data: the default layout.
    #[test]
    fn migrations_apply_to_an_empty_database_with_only_the_default_dashboard() {
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
                [
                    "attachments",
                    "dashboard_widgets",
                    "household_categories",
                    "household_object_attributes",
                    "household_objects",
                    "investments",
                    "maintenance_records",
                    "maintenance_tasks",
                    "settings",
                ]
            );

            for table in &tables {
                let rows: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
                    .fetch_one(&mut conn)
                    .await
                    .unwrap();
                let expected = if table == "dashboard_widgets" { 3 } else { 0 };
                assert_eq!(rows, expected, "{table}");
            }
            let widgets: Vec<String> = sqlx::query_scalar("SELECT widget_type FROM dashboard_widgets ORDER BY position")
                .fetch_all(&mut conn)
                .await
                .unwrap();
            assert_eq!(widgets, ["upcoming-maintenance", "recent-objects", "maintenance-costs"]);
            conn.close().await.unwrap();
        });
    }

    #[test]
    fn dashboard_widgets_reject_invalid_values() {
        tauri::async_runtime::block_on(async {
            let mut conn = migrated_connection().await;
            let rows = [
                "(' ', 9, 'small', '{}')",
                "('recent-objects', -1, 'small', '{}')",
                "('recent-objects', 9, 'huge', '{}')",
                "('recent-objects', 9, 'small', 'not json')",
                "('recent-objects', 9, 'small', '[1]')",
            ];
            for values in rows {
                let sql = format!("INSERT INTO dashboard_widgets (widget_type, position, size, settings) VALUES {values}");
                let error = run_sql(&mut conn, &sql).await.unwrap_err();
                assert!(error.contains("CHECK constraint failed"), "{values}: {error}");
            }
            let blank_title = "INSERT INTO dashboard_widgets (widget_type, position, size, title) VALUES ('x', 9, 'small', '  ')";
            assert!(run_sql(&mut conn, blank_title).await.unwrap_err().contains("CHECK constraint failed"));
            let same_position = "INSERT INTO dashboard_widgets (widget_type, position, size) VALUES ('x', 0, 'small')";
            assert!(run_sql(&mut conn, same_position).await.unwrap_err().contains("UNIQUE constraint failed"));
            conn.close().await.unwrap();
        });
    }

    /// Status, dates and amounts of investments (migration 0008).
    #[test]
    fn investments_reject_invalid_values_and_need_a_purchase_date_exactly_when_purchased() {
        tauri::async_runtime::block_on(async {
            let mut conn = migrated_connection().await;
            let insert = "INSERT INTO investments (title, estimated_cost_cents, priority";
            let invalid = [
                ", status) VALUES ('A', 1, 'low', 'bought')",
                ", target_date) VALUES ('A', 1, 'low', '2026-02-30')",
                ", budget_cents) VALUES ('A', 1, 'low', -1)",
                ", saved_cents) VALUES ('A', 1, 'low', -1)",
                ", status, purchased_date) VALUES ('A', 1, 'low', 'purchased', '2026-13-01')",
            ];
            for rest in invalid {
                let error = run_sql(&mut conn, &format!("{insert}{rest}")).await.unwrap_err();
                assert!(error.contains("CHECK constraint failed"), "{rest}: {error}");
            }
            let mismatched = [
                ", status) VALUES ('A', 1, 'low', 'purchased')",
                ", purchased_date) VALUES ('A', 1, 'low', '2026-01-01')",
            ];
            for rest in mismatched {
                let error = run_sql(&mut conn, &format!("{insert}{rest}")).await.unwrap_err();
                assert!(error.contains("need a purchase date"), "{rest}: {error}");
            }

            let planned = format!("{insert}, target_date, budget_cents, saved_cents) VALUES ('A', 1, 'low', '2027-01-01', 5, 2)");
            run_sql(&mut conn, &planned).await.unwrap();
            let purchase_without_date = run_sql(&mut conn, "UPDATE investments SET status = 'purchased'").await;
            assert!(purchase_without_date.unwrap_err().contains("need a purchase date"));
            run_sql(&mut conn, "UPDATE investments SET status = 'purchased', purchased_date = '2026-11-18'")
                .await
                .unwrap();
            let defaults = ids(&mut conn, "SELECT COUNT(*) FROM investments WHERE status = 'purchased'").await;
            assert_eq!(defaults, [Some(1)]);
            conn.close().await.unwrap();
        });
    }

    /// Attribute names are unique per object (ignoring case) and go away with their object.
    #[test]
    fn object_attributes_are_unique_per_object_and_deleted_with_it() {
        tauri::async_runtime::block_on(async {
            let mut conn = migrated_connection().await;
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

    const TWO_OBJECTS: &str = "INSERT INTO household_objects (id, name) VALUES (1, 'Heat pump'), (2, 'Boiler')";

    /// Tasks and records go away with their object; deleting a task keeps its records.
    #[test]
    fn maintenance_belongs_to_its_object_and_records_outlive_their_task() {
        tauri::async_runtime::block_on(async {
            let mut conn = migrated_connection().await;
            run_sql(&mut conn, TWO_OBJECTS).await.unwrap();
            run_sql(
                &mut conn,
                "INSERT INTO maintenance_tasks (id, household_object_id, name, interval_value, interval_unit)
                 VALUES (1, 1, 'Service', 1, 'year'), (2, 2, 'Service', 1, 'year');
                 INSERT INTO maintenance_records (id, household_object_id, task_id, date, cost_cents)
                 VALUES (1, 1, 1, '2025-10-01', 25000), (2, 2, 2, '2025-10-02', NULL)",
            )
            .await
            .unwrap();

            let duplicate = run_sql(
                &mut conn,
                "INSERT INTO maintenance_tasks (household_object_id, name, interval_value, interval_unit)
                 VALUES (1, 'SERVICE', 1, 'year')",
            )
            .await;
            assert!(duplicate.unwrap_err().contains("UNIQUE constraint failed"));

            run_sql(&mut conn, "DELETE FROM maintenance_tasks WHERE id = 1").await.unwrap();
            assert_eq!(ids(&mut conn, "SELECT task_id FROM maintenance_records ORDER BY id").await, [None, Some(2)]);

            run_sql(&mut conn, "DELETE FROM household_objects WHERE id = 2").await.unwrap();
            assert!(ids(&mut conn, "SELECT id FROM maintenance_tasks").await.is_empty());
            assert_eq!(ids(&mut conn, "SELECT id FROM maintenance_records").await, [Some(1)]);
            conn.close().await.unwrap();
        });
    }

    #[test]
    fn maintenance_rejects_invalid_values() {
        tauri::async_runtime::block_on(async {
            let mut conn = migrated_connection().await;
            run_sql(&mut conn, TWO_OBJECTS).await.unwrap();
            let tasks = ["(1, 'a', 0, 'year', NULL)", "(1, 'b', 1, 'decade', NULL)", "(1, 'c', 1, 'day', '2025-13-01')"];
            for values in tasks {
                let sql = format!(
                    "INSERT INTO maintenance_tasks (household_object_id, name, interval_value, interval_unit, last_done_date)
                     VALUES {values}"
                );
                let error = run_sql(&mut conn, &sql).await.unwrap_err();
                assert!(error.contains("CHECK constraint failed"), "{values}: {error}");
            }
            for values in ["(1, '01.10.2025', NULL)", "(1, '2025-10-01', -1)"] {
                let sql = format!("INSERT INTO maintenance_records (household_object_id, date, cost_cents) VALUES {values}");
                let error = run_sql(&mut conn, &sql).await.unwrap_err();
                assert!(error.contains("CHECK constraint failed"), "{values}: {error}");
            }
            conn.close().await.unwrap();
        });
    }

    /// A record can't point to a task of another object, neither on insert nor on update.
    #[test]
    fn maintenance_records_and_their_task_belong_to_the_same_object() {
        tauri::async_runtime::block_on(async {
            let mut conn = migrated_connection().await;
            run_sql(&mut conn, TWO_OBJECTS).await.unwrap();
            run_sql(
                &mut conn,
                "INSERT INTO maintenance_tasks (id, household_object_id, name, interval_value, interval_unit)
                 VALUES (1, 1, 'Service', 1, 'year');
                 INSERT INTO maintenance_records (id, household_object_id, task_id, date)
                 VALUES (1, 1, 1, '2025-10-01'), (2, 2, NULL, '2025-10-01')",
            )
            .await
            .unwrap();

            let wrong_insert = run_sql(
                &mut conn,
                "INSERT INTO maintenance_records (household_object_id, task_id, date) VALUES (2, 1, '2025-10-01')",
            )
            .await;
            assert!(wrong_insert.unwrap_err().contains("belong to different objects"));
            let wrong_update = run_sql(&mut conn, "UPDATE maintenance_records SET task_id = 1 WHERE id = 2").await;
            assert!(wrong_update.unwrap_err().contains("belong to different objects"));
            let unknown_task = run_sql(
                &mut conn,
                "INSERT INTO maintenance_records (household_object_id, task_id, date) VALUES (1, 99, '2025-10-01')",
            )
            .await;
            assert!(unknown_task.unwrap_err().contains("FOREIGN KEY constraint failed"));
            conn.close().await.unwrap();
        });
    }

    const ATTACHMENT: &str = "INSERT INTO attachments
        (household_object_id, maintenance_record_id, stored_name, original_name, mime_type, size_bytes, document_type)";

    /// Exactly one owner; attachments go away with their object or maintenance record.
    #[test]
    fn attachments_have_exactly_one_owner_and_are_deleted_with_it() {
        tauri::async_runtime::block_on(async {
            let mut conn = migrated_connection().await;
            run_sql(&mut conn, TWO_OBJECTS).await.unwrap();
            run_sql(
                &mut conn,
                &format!(
                    "INSERT INTO maintenance_records (id, household_object_id, date) VALUES (1, 2, '2025-10-01');
                     {ATTACHMENT} VALUES (1, NULL, 'a.pdf', 'invoice.pdf', 'application/pdf', 10, 'invoice'),
                                         (NULL, 1, 'b.jpg', 'receipt.jpg', 'image/jpeg', 20, 'receipt')"
                ),
            )
            .await
            .unwrap();

            for owners in ["NULL, NULL", "1, 1"] {
                let sql = format!("{ATTACHMENT} VALUES ({owners}, 'c.pdf', 'x.pdf', 'application/pdf', 1, 'other')");
                assert!(run_sql(&mut conn, &sql).await.unwrap_err().contains("exactly one owner"), "{owners}");
            }
            let both = run_sql(&mut conn, "UPDATE attachments SET maintenance_record_id = 1 WHERE stored_name = 'a.pdf'");
            assert!(both.await.unwrap_err().contains("exactly one owner"));
            let unknown_type = format!("{ATTACHMENT} VALUES (1, NULL, 'd.pdf', 'x.pdf', 'application/pdf', 1, 'letter')");
            assert!(run_sql(&mut conn, &unknown_type).await.unwrap_err().contains("CHECK constraint failed"));
            let bad_date = "INSERT INTO attachments (household_object_id, stored_name, original_name, mime_type, size_bytes,
                            document_type, document_date) VALUES (1, 'e.pdf', 'x.pdf', 'application/pdf', 1, 'other', '2025-02-30')";
            assert!(run_sql(&mut conn, bad_date).await.unwrap_err().contains("CHECK constraint failed"));
            let same_file = format!("{ATTACHMENT} VALUES (1, NULL, 'a.pdf', 'x.pdf', 'application/pdf', 1, 'other')");
            assert!(run_sql(&mut conn, &same_file).await.unwrap_err().contains("UNIQUE constraint failed"));

            // Deleting object 2 deletes its record, and with it the record's receipt.
            run_sql(&mut conn, "DELETE FROM household_objects WHERE id = 2").await.unwrap();
            assert_eq!(ids(&mut conn, "SELECT household_object_id FROM attachments").await, [Some(1)]);
            run_sql(&mut conn, "DELETE FROM household_objects WHERE id = 1").await.unwrap();
            assert!(ids(&mut conn, "SELECT id FROM attachments").await.is_empty());
            conn.close().await.unwrap();
        });
    }
}
