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
        Migration {
            version: 9,
            description: "create_costs",
            sql: include_str!("../migrations/0009_create_costs.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "move_maintenance_costs",
            sql: include_str!("../migrations/0010_move_maintenance_costs.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "add_tax_category_taxes",
            sql: include_str!("../migrations/0011_add_tax_category_taxes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "taxes_as_cost_type",
            sql: include_str!("../migrations/0012_taxes_as_cost_type.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "create_income",
            sql: include_str!("../migrations/0013_create_income.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "categories_instead_of_types",
            sql: include_str!("../migrations/0014_categories_instead_of_types.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "create_projects",
            sql: include_str!("../migrations/0015_create_projects.sql"),
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
        connection_at(i64::MAX).await
    }

    /// An in-memory database with the migrations up to `version` applied.
    async fn connection_at(version: i64) -> sqlx::SqliteConnection {
        let mut conn = SqliteConnectOptions::new().in_memory(true).connect().await.unwrap();
        for migration in all().into_iter().filter(|m| m.version <= version) {
            sqlx::raw_sql(migration.sql).execute(&mut conn).await.unwrap();
        }
        conn
    }

    /// Runs migration `version` on `conn`.
    async fn apply(conn: &mut sqlx::SqliteConnection, version: i64) {
        let migration = all().into_iter().find(|m| m.version == version).unwrap();
        sqlx::raw_sql(migration.sql).execute(conn).await.unwrap();
    }

    /// Runs `sql`; the error as text, for `contains` checks.
    async fn run_sql(conn: &mut sqlx::SqliteConnection, sql: &str) -> Result<(), String> {
        sqlx::raw_sql(sql).execute(conn).await.map(drop).map_err(crate::error::error_text)
    }

    async fn ids(conn: &mut sqlx::SqliteConnection, sql: &str) -> Vec<Option<i64>> {
        sqlx::query_scalar(sql).fetch_all(conn).await.unwrap()
    }

    /// Only the dashboard (the default layout) has seed data (the tax categories went with 0014).
    #[test]
    fn migrations_apply_to_an_empty_database_with_only_the_seed_data() {
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
                    "costs",
                    "dashboard_widgets",
                    "household_categories",
                    "household_object_attributes",
                    "household_objects",
                    "income",
                    "investments",
                    "maintenance_records",
                    "maintenance_tasks",
                    "projects",
                    "recurring_costs",
                    "recurring_income",
                    "settings",
                ]
            );

            for table in &tables {
                let rows: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
                    .fetch_one(&mut conn)
                    .await
                    .unwrap();
                let expected = match table.as_str() {
                    "dashboard_widgets" => 3,
                    _ => 0,
                };
                assert_eq!(rows, expected, "{table}");
            }
            let widgets: Vec<String> = sqlx::query_scalar("SELECT widget_type FROM dashboard_widgets ORDER BY position")
                .fetch_all(&mut conn)
                .await
                .unwrap();
            assert_eq!(widgets, ["upcoming-maintenance", "recent-objects", "costs"]);
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
            run_sql(&mut conn, ONE_PROJECT).await.unwrap();
            let insert = "INSERT INTO investments (project_id, title, estimated_cost_cents, priority";
            let invalid = [
                ", status) VALUES (1, 'A', 1, 'low', 'bought')",
                ", target_date) VALUES (1, 'A', 1, 'low', '2026-02-30')",
                ", budget_cents) VALUES (1, 'A', 1, 'low', -1)",
                ", saved_cents) VALUES (1, 'A', 1, 'low', -1)",
                ", status, purchased_date) VALUES (1, 'A', 1, 'low', 'purchased', '2026-13-01')",
            ];
            for rest in invalid {
                let error = run_sql(&mut conn, &format!("{insert}{rest}")).await.unwrap_err();
                assert!(error.contains("CHECK constraint failed"), "{rest}: {error}");
            }
            let mismatched = [
                ", status) VALUES (1, 'A', 1, 'low', 'purchased')",
                ", purchased_date) VALUES (1, 'A', 1, 'low', '2026-01-01')",
            ];
            for rest in mismatched {
                let error = run_sql(&mut conn, &format!("{insert}{rest}")).await.unwrap_err();
                assert!(error.contains("need a purchase date"), "{rest}: {error}");
            }

            let planned = format!("{insert}, target_date, budget_cents, saved_cents) VALUES (1, 'A', 1, 'low', '2027-01-01', 5, 2)");
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

    /// A project for investments (migration 0015: every investment needs one).
    const ONE_PROJECT: &str = "INSERT INTO projects (id, name) VALUES (1, 'House')";

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
                 INSERT INTO maintenance_records (id, household_object_id, task_id, date)
                 VALUES (1, 1, 1, '2025-10-01'), (2, 2, 2, '2025-10-02')",
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
            let bad_date = "INSERT INTO maintenance_records (household_object_id, date) VALUES (1, '01.10.2025')";
            assert!(run_sql(&mut conn, bad_date).await.unwrap_err().contains("CHECK constraint failed"));
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

    /// Migration 0010: record costs become cost rows; the costs widget keeps showing maintenance costs.
    #[test]
    fn maintenance_costs_move_into_the_costs_table() {
        tauri::async_runtime::block_on(async {
            let mut conn = connection_at(9).await;
            run_sql(
                &mut conn,
                &format!(
                    "{TWO_OBJECTS};
                     INSERT INTO maintenance_records (id, household_object_id, date, cost_cents, provider)
                     VALUES (1, 1, '2025-10-01', 25000, 'Heating Co'), (2, 2, '2025-10-02', NULL, NULL);
                     UPDATE dashboard_widgets SET settings = '{{\"chartType\":\"line\"}}' WHERE widget_type = 'maintenance-costs'"
                ),
            )
            .await
            .unwrap();

            apply(&mut conn, 10).await;

            let moved: Vec<(String, i64, String, Option<String>, i64)> = sqlx::query_as(
                "SELECT paid_date, amount_cents, cost_type, payee, maintenance_record_id FROM costs",
            )
            .fetch_all(&mut conn)
            .await
            .unwrap();
            assert_eq!(moved, [("2025-10-01".to_string(), 25000, "maintenance".to_string(), Some("Heating Co".to_string()), 1)]);
            let columns: Vec<String> = sqlx::query_scalar("SELECT name FROM pragma_table_info('maintenance_records')")
                .fetch_all(&mut conn)
                .await
                .unwrap();
            assert!(!columns.contains(&"cost_cents".to_string()), "{columns:?}");
            let widget: (String, String) =
                sqlx::query_as("SELECT widget_type, settings FROM dashboard_widgets WHERE position = 2")
                    .fetch_one(&mut conn)
                    .await
                    .unwrap();
            assert_eq!(widget, ("costs".to_string(), r#"{"chartType":"line","costType":"maintenance"}"#.to_string()));
            conn.close().await.unwrap();
        });
    }

    async fn category_names(conn: &mut sqlx::SqliteConnection) -> Vec<String> {
        sqlx::query_scalar("SELECT name FROM tax_categories ORDER BY sort_order, id").fetch_all(conn).await.unwrap()
    }

    /// Migration 0011: "Steuern und Abgaben" goes before "Sonstiges", at the end without it, never twice.
    #[test]
    fn the_taxes_category_is_added_once_before_sonstiges() {
        tauri::async_runtime::block_on(async {
            let mut conn = connection_at(11).await;
            let names = category_names(&mut conn).await;
            assert_eq!(names[names.len() - 2..], ["Steuern und Abgaben".to_string(), "Sonstiges".to_string()]);

            let mut conn = connection_at(10).await;
            run_sql(&mut conn, "DELETE FROM tax_categories WHERE name = 'Sonstiges'").await.unwrap();
            apply(&mut conn, 11).await;
            assert_eq!(category_names(&mut conn).await.last().map(String::as_str), Some("Steuern und Abgaben"));

            let mut conn = connection_at(10).await;
            run_sql(&mut conn, "DELETE FROM tax_categories; INSERT INTO tax_categories (name) VALUES ('steuern und abgaben')")
                .await
                .unwrap();
            apply(&mut conn, 11).await;
            assert_eq!(category_names(&mut conn).await, ["steuern und abgaben"]);

            let mut conn = connection_at(10).await;
            run_sql(&mut conn, "DELETE FROM tax_categories").await.unwrap();
            apply(&mut conn, 11).await;
            assert_eq!(category_names(&mut conn).await, ["Steuern und Abgaben"]);
            conn.close().await.unwrap();
        });
    }

    /// Migration 0012: costs and rules filed under "Steuern und Abgaben" become the cost type 'tax',
    /// which has no tax category or labour share; the category goes again.
    #[test]
    fn taxes_become_a_cost_type() {
        tauri::async_runtime::block_on(async {
            let mut conn = connection_at(11).await;
            run_sql(
                &mut conn,
                "INSERT INTO costs (id, paid_date, amount_cents, labour_cents, cost_type, description, tax_category_id)
                 VALUES (1, '2026-02-15', 12000, NULL, 'other', 'Grundsteuer',
                         (SELECT id FROM tax_categories WHERE name = 'Steuern und Abgaben')),
                        (2, '2026-03-01', 5000, 1000, 'tax', 'Kfz-Steuer',
                         (SELECT id FROM tax_categories WHERE name = 'Handwerkerleistungen')),
                        (3, '2026-03-02', 8000, 2000, 'repair', 'Painter',
                         (SELECT id FROM tax_categories WHERE name = 'Handwerkerleistungen'));
                 INSERT INTO recurring_costs (id, description, amount_cents, cost_type, tax_category_id,
                                              interval_value, interval_unit, start_date, next_due_date)
                 VALUES (1, 'Grundsteuer', 12000, 'other',
                         (SELECT id FROM tax_categories WHERE name = 'Steuern und Abgaben'),
                         3, 'month', '2026-02-15', '2026-02-15')",
            )
            .await
            .unwrap();

            apply(&mut conn, 12).await;

            let costs: Vec<(String, Option<i64>, Option<i64>)> =
                sqlx::query_as("SELECT cost_type, tax_category_id, labour_cents FROM costs ORDER BY id")
                    .fetch_all(&mut conn)
                    .await
                    .unwrap();
            assert_eq!(
                costs,
                [("tax".to_string(), None, None), ("tax".to_string(), None, None), ("repair".to_string(), Some(2), Some(2000))]
            );
            let rule: (String, Option<i64>) =
                sqlx::query_as("SELECT cost_type, tax_category_id FROM recurring_costs").fetch_one(&mut conn).await.unwrap();
            assert_eq!(rule, ("tax".to_string(), None));
            assert!(!category_names(&mut conn).await.contains(&"Steuern und Abgaben".to_string()));
            conn.close().await.unwrap();
        });
    }

    const COST: &str = "INSERT INTO costs (paid_date, amount_cents, category, description, payment_method)";

    /// Dates, amounts, the category and the enumerations of costs and their rules (migrations 0009, 0014).
    #[test]
    fn costs_reject_invalid_values() {
        tauri::async_runtime::block_on(async {
            let mut conn = migrated_connection().await;
            let invalid = [
                "('2026-02-30', 100, 'Reparatur', 'A', NULL)",
                "('2026-01-01', -1, 'Reparatur', 'A', NULL)",
                "('2026-01-01', 100, ' ', 'A', NULL)",
                "('2026-01-01', 100, 'Reparatur', ' ', NULL)",
                "('2026-01-01', 100, 'Reparatur', NULL, NULL)",
                "('2026-01-01', 100, 'Reparatur', 'A', 'cheque')",
            ];
            for values in invalid {
                let error = run_sql(&mut conn, &format!("{COST} VALUES {values}")).await.unwrap_err();
                assert!(error.contains("CHECK constraint failed"), "{values}: {error}");
            }
            run_sql(&mut conn, &format!("{COST} VALUES ('2026-01-01', 100, NULL, 'A', 'transfer')")).await.unwrap();

            let rule = "INSERT INTO recurring_costs (description, amount_cents, category, interval_value, interval_unit,
                        start_date, end_date, next_due_date)";
            let invalid_rules = [
                "('A', 0, NULL, 1, 'month', '2026-01-01', NULL, '2026-01-01')",
                "('A', 1, '', 1, 'month', '2026-01-01', NULL, '2026-01-01')",
                "('A', 1, NULL, 0, 'month', '2026-01-01', NULL, '2026-01-01')",
                "('A', 1, NULL, 1, 'decade', '2026-01-01', NULL, '2026-01-01')",
                "('A', 1, NULL, 1, 'month', '2026-01-01', '2025-12-31', '2026-01-01')",
                "('A', 1, NULL, 1, 'month', '2026-01-01', NULL, '2026-02-30')",
            ];
            for values in invalid_rules {
                let error = run_sql(&mut conn, &format!("{rule} VALUES {values}")).await.unwrap_err();
                assert!(error.contains("CHECK constraint failed"), "{values}: {error}");
            }
            conn.close().await.unwrap();
        });
    }

    /// A cost has at most one link; the cost of a maintenance record goes with it, other
    /// links and its rule are only cleared. Receipts go with their cost.
    #[test]
    fn costs_have_at_most_one_link_and_keep_their_data_when_a_reference_is_deleted() {
        tauri::async_runtime::block_on(async {
            let mut conn = migrated_connection().await;
            run_sql(
                &mut conn,
                &format!(
                    "{TWO_OBJECTS};
                     INSERT INTO maintenance_records (id, household_object_id, date) VALUES (1, 2, '2025-10-01');
                     {ONE_PROJECT};
                     INSERT INTO investments (id, project_id, title, estimated_cost_cents, priority)
                     VALUES (1, 1, 'Car', 1, 'low');
                     INSERT INTO recurring_costs (id, description, amount_cents, interval_value, interval_unit, start_date,
                                                  next_due_date)
                     VALUES (1, 'Paint', 100, 1, 'year', '2026-01-01', '2027-01-01');
                     INSERT INTO costs (id, paid_date, amount_cents, description, household_object_id, recurring_cost_id)
                     VALUES (1, '2026-01-01', 100, 'Paint', 1, 1);
                     INSERT INTO costs (id, paid_date, amount_cents, maintenance_record_id) VALUES (2, '2025-10-01', 200, 1);
                     INSERT INTO costs (id, paid_date, amount_cents, description, investment_id)
                     VALUES (3, '2026-02-01', 300, 'Car', 1);
                     INSERT INTO attachments (cost_id, stored_name, original_name, mime_type, size_bytes, document_type)
                     VALUES (3, 'r.pdf', 'r.pdf', 'application/pdf', 1, 'receipt')"
                ),
            )
            .await
            .unwrap();

            run_sql(&mut conn, &format!("{COST} VALUES ('2026-01-01', 1, NULL, 'A', NULL)")).await.unwrap();
            let linked_twice = run_sql(&mut conn, "UPDATE costs SET household_object_id = 1, investment_id = 1 WHERE id = 4");
            assert!(linked_twice.await.unwrap_err().contains("at most one"));
            let same_record = "INSERT INTO costs (paid_date, amount_cents, maintenance_record_id) VALUES ('2025-10-01', 1, 1)";
            assert!(run_sql(&mut conn, same_record).await.unwrap_err().contains("UNIQUE constraint failed"));
            let two_owners = run_sql(&mut conn, "UPDATE attachments SET household_object_id = 1");
            assert!(two_owners.await.unwrap_err().contains("exactly one owner"));

            run_sql(
                &mut conn,
                "DELETE FROM household_objects WHERE id = 1; DELETE FROM investments; DELETE FROM recurring_costs",
            )
            .await
            .unwrap();
            let links = "SELECT coalesce(household_object_id, investment_id, recurring_cost_id) FROM costs WHERE id IN (1, 3)";
            assert_eq!(ids(&mut conn, links).await, [None, None]);
            run_sql(&mut conn, "DELETE FROM maintenance_records").await.unwrap();
            assert_eq!(ids(&mut conn, "SELECT id FROM costs ORDER BY id").await, [Some(1), Some(3), Some(4)]);
            run_sql(&mut conn, "DELETE FROM costs WHERE id = 3").await.unwrap();
            assert!(ids(&mut conn, "SELECT id FROM attachments").await.is_empty());
            conn.close().await.unwrap();
        });
    }

    const INCOME: &str = "INSERT INTO income (received_date, amount_cents, description, payment_method, category)";

    /// Dates, amounts, the category and the enumerations of income and its rules (migration 0013).
    #[test]
    fn income_rejects_invalid_values() {
        tauri::async_runtime::block_on(async {
            let mut conn = migrated_connection().await;
            let invalid = [
                "('2026-02-30', 100, 'A', NULL, NULL)",
                "('2026-01-01', -1, 'A', NULL, NULL)",
                "('2026-01-01', 100, ' ', NULL, NULL)",
                "('2026-01-01', 100, 'A', 'cheque', NULL)",
                "('2026-01-01', 100, 'A', NULL, ' ')",
            ];
            for values in invalid {
                let error = run_sql(&mut conn, &format!("{INCOME} VALUES {values}")).await.unwrap_err();
                assert!(error.contains("CHECK constraint failed"), "{values}: {error}");
            }
            let without_description = format!("{INCOME} VALUES ('2026-01-01', 100, NULL, NULL, NULL)");
            let error = run_sql(&mut conn, &without_description).await.unwrap_err();
            assert!(error.contains("NOT NULL constraint failed"), "{error}");
            run_sql(&mut conn, &format!("{INCOME} VALUES ('2026-01-01', 0, 'A', 'transfer', 'Photovoltaik')"))
                .await
                .unwrap();

            let rule = "INSERT INTO recurring_income (description, amount_cents, category, interval_value,
                        interval_unit, start_date, end_date, next_due_date)";
            let invalid_rules = [
                "('A', 0, NULL, 1, 'month', '2026-01-01', NULL, '2026-01-01')",
                "('A', 1, '', 1, 'month', '2026-01-01', NULL, '2026-01-01')",
                "('A', 1, NULL, 0, 'month', '2026-01-01', NULL, '2026-01-01')",
                "('A', 1, NULL, 1, 'decade', '2026-01-01', NULL, '2026-01-01')",
                "('A', 1, NULL, 1, 'month', '2026-01-01', '2025-12-31', '2026-01-01')",
                "('A', 1, NULL, 1, 'month', '2026-01-01', NULL, '2026-02-30')",
            ];
            for values in invalid_rules {
                let error = run_sql(&mut conn, &format!("{rule} VALUES {values}")).await.unwrap_err();
                assert!(error.contains("CHECK constraint failed"), "{values}: {error}");
            }
            conn.close().await.unwrap();
        });
    }

    /// Income keeps its data when its object or rule is deleted; its documents go with it.
    #[test]
    fn income_keeps_its_data_when_a_reference_is_deleted() {
        tauri::async_runtime::block_on(async {
            let mut conn = migrated_connection().await;
            run_sql(
                &mut conn,
                &format!(
                    "{TWO_OBJECTS};
                     INSERT INTO recurring_income (id, description, amount_cents, interval_value, interval_unit,
                                                   start_date, next_due_date, household_object_id)
                     VALUES (1, 'Feed-in', 5000, 1, 'month', '2026-01-01', '2026-02-01', 1);
                     INSERT INTO income (id, received_date, amount_cents, description, household_object_id,
                                         recurring_income_id)
                     VALUES (1, '2026-01-01', 5000, 'Feed-in', 1, 1);
                     INSERT INTO attachments (income_id, stored_name, original_name, mime_type, size_bytes, document_type)
                     VALUES (1, 's.pdf', 's.pdf', 'application/pdf', 1, 'other')"
                ),
            )
            .await
            .unwrap();

            let two_owners = run_sql(&mut conn, "UPDATE attachments SET household_object_id = 1");
            assert!(two_owners.await.unwrap_err().contains("exactly one owner"));
            let no_owner = "INSERT INTO attachments (stored_name, original_name, mime_type, size_bytes, document_type)
                            VALUES ('t.pdf', 't.pdf', 'application/pdf', 1, 'other')";
            assert!(run_sql(&mut conn, no_owner).await.unwrap_err().contains("exactly one owner"));

            run_sql(&mut conn, "DELETE FROM household_objects WHERE id = 1; DELETE FROM recurring_income").await.unwrap();
            let links = "SELECT coalesce(household_object_id, recurring_income_id) FROM income";
            assert_eq!(ids(&mut conn, links).await, [None]);
            assert_eq!(ids(&mut conn, "SELECT income_id FROM attachments").await, [Some(1)]);
            run_sql(&mut conn, "DELETE FROM income").await.unwrap();
            assert!(ids(&mut conn, "SELECT id FROM attachments").await.is_empty());
            conn.close().await.unwrap();
        });
    }

    /// Data at schema 13 for migration 0014: costs and rules with a type and a tax
    /// category, a receipt, income with and without a category, and the cost widgets.
    const BEFORE_CATEGORIES: &str = "INSERT INTO household_objects (id, name) VALUES (1, 'Heat pump');
        INSERT INTO recurring_costs (id, description, amount_cents, labour_cents, cost_type, tax_category_id,
                                     interval_value, interval_unit, start_date, next_due_date)
        VALUES (1, 'Hausrat', 4000, NULL, 'insurance', NULL, 1, 'month', '2026-01-01', '2026-02-01'),
               (2, 'Gardener', 8000, 8000, 'service', 1, 1, 'month', '2026-01-01', '2026-02-01');
        INSERT INTO costs (id, paid_date, amount_cents, labour_cents, cost_type, description, tax_category_id,
                           household_object_id, recurring_cost_id)
        VALUES (1, '2026-01-01', 4000, NULL, 'insurance', 'Hausrat', NULL, NULL, 1),
               (2, '2026-03-02', 50000, 30000, 'repair', 'Painter', 2, 1, NULL),
               (3, '2026-03-03', 100, NULL, 'other', 'Odd', NULL, NULL, NULL);
        INSERT INTO attachments (id, cost_id, stored_name, original_name, mime_type, size_bytes, document_type)
        VALUES (1, 2, 'r.pdf', 'r.pdf', 'application/pdf', 1, 'receipt');
        INSERT INTO attachments (id, household_object_id, stored_name, original_name, mime_type, size_bytes, document_type)
        VALUES (2, 1, 'm.pdf', 'm.pdf', 'application/pdf', 1, 'manual');
        INSERT INTO income (id, received_date, amount_cents, income_type, description, category)
        VALUES (1, '2026-01-31', 5000, 'feed-in', 'Einspeisung', NULL), (2, '2026-02-01', 80000, 'rent', 'Miete', 'Wohnung');
        INSERT INTO recurring_income (id, description, amount_cents, income_type, interval_value, interval_unit,
                                      start_date, next_due_date)
        VALUES (1, 'Zinsen', 100, 'interest', 1, 'year', '2026-01-01', '2026-01-01');
        INSERT INTO dashboard_widgets (widget_type, position, size, settings)
        VALUES ('costs', 10, 'large', '{\"chartType\":\"line\",\"costType\":\"maintenance\"}'),
               ('costs', 11, 'large', '{\"costType\":null}'),
               ('tax-categories', 12, 'medium', '{\"chartType\":\"pie\",\"timeRange\":\"this-year\"}')";

    async fn texts(conn: &mut sqlx::SqliteConnection, sql: &str) -> Vec<Option<String>> {
        sqlx::query_scalar(sql).fetch_all(conn).await.unwrap()
    }

    fn some(values: &[&str]) -> Vec<Option<String>> {
        values.iter().map(|value| Some((*value).to_string())).collect()
    }

    /// Migration 0014: the tax category or the type becomes the category; receipts, links and widgets stay.
    #[test]
    fn types_and_tax_categories_become_categories() {
        tauri::async_runtime::block_on(async {
            let mut conn = connection_at(13).await;
            run_sql(&mut conn, BEFORE_CATEGORIES).await.unwrap();

            apply(&mut conn, 14).await;

            let costs = texts(&mut conn, "SELECT category FROM costs ORDER BY id").await;
            assert_eq!(costs, some(&["Versicherungen", "Handwerkerleistungen", "Sonstiges"]));
            let rules = texts(&mut conn, "SELECT category FROM recurring_costs ORDER BY id").await;
            assert_eq!(rules, some(&["Versicherungen", "Haushaltsnahe Dienstleistungen"]));
            assert_eq!(ids(&mut conn, "SELECT recurring_cost_id FROM costs WHERE id = 1").await, [Some(1)]);
            assert_eq!(ids(&mut conn, "SELECT household_object_id FROM costs WHERE id = 2").await, [Some(1)]);
            let owners = "SELECT coalesce(cost_id, household_object_id) FROM attachments ORDER BY id";
            assert_eq!(ids(&mut conn, owners).await, [Some(2), Some(1)]);
            let income = texts(&mut conn, "SELECT category FROM income ORDER BY id").await;
            assert_eq!(income, some(&["Photovoltaik", "Wohnung"]));
            assert_eq!(texts(&mut conn, "SELECT category FROM recurring_income").await, some(&["Kapitalerträge"]));
            let widgets = "SELECT widget_type || ' ' || settings FROM dashboard_widgets WHERE position >= 10 ORDER BY position";
            let widgets = texts(&mut conn, widgets).await;
            assert_eq!(
                widgets,
                some(&[
                    r#"costs {"chartType":"line","costCategory":"Wartung"}"#,
                    "costs {}",
                    r#"costs {"chartType":"pie","timeRange":"this-year"}"#,
                ])
            );
            for (table, gone) in [("costs", "cost_type"), ("costs", "labour_cents"), ("income", "income_type")] {
                let columns = texts(&mut conn, &format!("SELECT name FROM pragma_table_info('{table}')")).await;
                assert!(!columns.contains(&Some(gone.to_string())), "{table}.{gone}");
            }
            let helpers = "SELECT name FROM sqlite_master WHERE name IN ('tax_categories', 'category_names', 'cost_documents')";
            let tables = texts(&mut conn, helpers).await;
            assert!(tables.is_empty(), "{tables:?}");

            // The rebuilt tables keep their triggers, and deleting a cost deletes its receipt again.
            let two_owners = run_sql(&mut conn, "UPDATE attachments SET household_object_id = 1 WHERE id = 1");
            assert!(two_owners.await.unwrap_err().contains("exactly one owner"));
            run_sql(&mut conn, "INSERT INTO investments (id, title, estimated_cost_cents, priority) VALUES (1, 'Car', 1, 'low')")
                .await
                .unwrap();
            let linked_twice = run_sql(&mut conn, "UPDATE costs SET investment_id = 1 WHERE id = 2");
            assert!(linked_twice.await.unwrap_err().contains("at most one"));
            run_sql(&mut conn, "DELETE FROM costs WHERE id = 2").await.unwrap();
            assert_eq!(ids(&mut conn, "SELECT id FROM attachments").await, [Some(2)]);
            conn.close().await.unwrap();
        });
    }

    /// Migration 0014 names the old types in English when the UI language is English.
    #[test]
    fn types_become_english_categories_for_an_english_ui() {
        tauri::async_runtime::block_on(async {
            let mut conn = connection_at(13).await;
            run_sql(&mut conn, BEFORE_CATEGORIES).await.unwrap();
            run_sql(&mut conn, "INSERT INTO settings (key, value) VALUES ('general.language', 'en')").await.unwrap();

            apply(&mut conn, 14).await;

            let costs = texts(&mut conn, "SELECT category FROM costs ORDER BY id").await;
            assert_eq!(costs, some(&["Insurance", "Handwerkerleistungen", "Other"]));
            assert_eq!(texts(&mut conn, "SELECT category FROM income WHERE id = 1").await, some(&["Solar power"]));
            conn.close().await.unwrap();
        });
    }

    /// Migration 0015: existing investments move into one default project, named in the UI language.
    #[test]
    fn existing_investments_move_into_a_default_project() {
        tauri::async_runtime::block_on(async {
            for (language, name) in [(None, "Allgemein"), (Some("de"), "Allgemein"), (Some("en"), "General")] {
                let mut conn = connection_at(14).await;
                if let Some(language) = language {
                    let setting = format!("INSERT INTO settings (key, value) VALUES ('general.language', '{language}')");
                    run_sql(&mut conn, &setting).await.unwrap();
                }
                run_sql(
                    &mut conn,
                    "INSERT INTO investments (id, title, estimated_cost_cents, priority) VALUES (1, 'Roof', 1, 'high'), (2, 'Car', 2, 'low');
                     INSERT INTO costs (id, paid_date, amount_cents, description, investment_id) VALUES (1, '2026-01-01', 1, 'Car', 2)",
                )
                .await
                .unwrap();

                apply(&mut conn, 15).await;

                assert_eq!(texts(&mut conn, "SELECT name FROM projects").await, some(&[name]));
                let projects = ids(&mut conn, "SELECT project_id FROM investments ORDER BY id").await;
                assert_eq!(projects, [Some(1), Some(1)]);
                assert_eq!(ids(&mut conn, "SELECT investment_id FROM costs").await, [Some(2)]);
                conn.close().await.unwrap();
            }
        });
    }

    /// Migration 0015 creates no project for a database without investments.
    #[test]
    fn no_default_project_without_investments() {
        tauri::async_runtime::block_on(async {
            let mut conn = migrated_connection().await;
            assert_eq!(ids(&mut conn, "SELECT COUNT(*) FROM projects").await, [Some(0)]);
            conn.close().await.unwrap();
        });
    }

    /// Investments need a project and go with it; project names are unique ignoring case.
    #[test]
    fn investments_belong_to_a_project_with_a_unique_name() {
        tauri::async_runtime::block_on(async {
            let mut conn = migrated_connection().await;
            run_sql(&mut conn, ONE_PROJECT).await.unwrap();
            let without = run_sql(&mut conn, "INSERT INTO investments (title, estimated_cost_cents, priority) VALUES ('A', 1, 'low')");
            assert!(without.await.unwrap_err().contains("need a project"));
            let unknown = "INSERT INTO investments (project_id, title, estimated_cost_cents, priority) VALUES (9, 'A', 1, 'low')";
            assert!(run_sql(&mut conn, unknown).await.unwrap_err().contains("FOREIGN KEY constraint failed"));
            let insert = "INSERT INTO investments (id, project_id, title, estimated_cost_cents, priority) VALUES (1, 1, 'A', 1, 'low')";
            run_sql(&mut conn, insert).await.unwrap();
            let cleared = run_sql(&mut conn, "UPDATE investments SET project_id = NULL");
            assert!(cleared.await.unwrap_err().contains("need a project"));

            let blank = run_sql(&mut conn, "INSERT INTO projects (name) VALUES ('  ')");
            assert!(blank.await.unwrap_err().contains("CHECK constraint failed"));
            let same_name = run_sql(&mut conn, "INSERT INTO projects (name) VALUES (' house ')");
            assert!(same_name.await.unwrap_err().contains("UNIQUE constraint failed"));

            run_sql(&mut conn, "INSERT INTO costs (id, paid_date, amount_cents, description, investment_id) VALUES (1, '2026-01-01', 1, 'A', 1)")
                .await
                .unwrap();
            run_sql(&mut conn, "DELETE FROM projects").await.unwrap();
            assert_eq!(ids(&mut conn, "SELECT COUNT(*) FROM investments").await, [Some(0)]);
            assert_eq!(ids(&mut conn, "SELECT investment_id FROM costs").await, [None]);
            conn.close().await.unwrap();
        });
    }
}
