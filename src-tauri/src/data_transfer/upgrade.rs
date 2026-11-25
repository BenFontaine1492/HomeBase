//! Brings the tables of an older JSON export up to this app's schema before they
//! are imported. Backups need no such step: a restored database runs the
//! migrations. An export holds rows only, so what a migration did to the data is
//! done here again, on the JSON.

use serde_json::{json, Map, Value};

/// The schema version (migration 0010) that moved `maintenance_records.cost_cents`
/// into `costs` and renamed the "maintenance-costs" widget to "costs".
const COSTS_MOVED: i64 = 10;

/// Upgrades `tables` of an export made with schema `schema_version`, in place.
pub(super) fn upgrade_tables(schema_version: i64, tables: &mut Map<String, Value>) {
    if schema_version < COSTS_MOVED {
        move_maintenance_costs(tables);
        rename_cost_widgets(tables);
    }
}

/// The rows of `table` (every row is an object, see `parse_export`); none if it is missing.
fn rows_mut<'a>(tables: &'a mut Map<String, Value>, table: &str) -> impl Iterator<Item = &'a mut Map<String, Value>> {
    tables.get_mut(table).and_then(Value::as_array_mut).into_iter().flatten().filter_map(Value::as_object_mut)
}

/// Like migration 0010: each record's cost becomes a cost row of type 'maintenance'.
fn move_maintenance_costs(tables: &mut Map<String, Value>) {
    let mut costs = Vec::new();
    for record in rows_mut(tables, "maintenance_records") {
        let cost = record.remove("cost_cents").unwrap_or(Value::Null);
        if cost.is_null() {
            continue;
        }
        costs.push(json!({
            "paid_date": record.get("date"),
            "amount_cents": cost,
            "cost_type": "maintenance",
            "payee": record.get("provider"),
            "maintenance_record_id": record.get("id"),
        }));
    }
    if costs.is_empty() {
        return;
    }
    let table = tables.entry("costs").or_insert_with(|| Value::Array(Vec::new()));
    if let Value::Array(rows) = table {
        rows.extend(costs);
    }
}

/// Like migration 0010: the "maintenance-costs" widget becomes "costs", showing maintenance costs.
fn rename_cost_widgets(tables: &mut Map<String, Value>) {
    for widget in rows_mut(tables, "dashboard_widgets") {
        if widget.get("widget_type").and_then(Value::as_str) != Some("maintenance-costs") {
            continue;
        }
        let mut settings: Map<String, Value> = widget
            .get("settings")
            .and_then(Value::as_str)
            .and_then(|text| serde_json::from_str(text).ok())
            .unwrap_or_default();
        settings.insert("costType".into(), json!("maintenance"));
        widget.insert("widget_type".into(), json!("costs"));
        widget.insert("settings".into(), json!(Value::Object(settings).to_string()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tables(value: Value) -> Map<String, Value> {
        value.as_object().cloned().unwrap()
    }

    #[test]
    fn moves_the_costs_of_maintenance_records() {
        let mut old = tables(json!({
            "maintenance_records": [
                { "id": 1, "household_object_id": 1, "date": "2025-10-01", "cost_cents": 25000, "provider": "Heating Co" },
                { "id": 2, "household_object_id": 1, "date": "2025-10-02", "cost_cents": null },
                { "id": 3, "household_object_id": 1, "date": "2025-10-03" },
            ],
        }));

        upgrade_tables(9, &mut old);

        assert_eq!(
            Value::Object(old),
            json!({
                "maintenance_records": [
                    { "id": 1, "household_object_id": 1, "date": "2025-10-01", "provider": "Heating Co" },
                    { "id": 2, "household_object_id": 1, "date": "2025-10-02" },
                    { "id": 3, "household_object_id": 1, "date": "2025-10-03" },
                ],
                "costs": [{
                    "paid_date": "2025-10-01",
                    "amount_cents": 25000,
                    "cost_type": "maintenance",
                    "payee": "Heating Co",
                    "maintenance_record_id": 1,
                }],
            })
        );
    }

    #[test]
    fn adds_to_existing_costs_and_leaves_exports_without_costs_alone() {
        let mut with_costs = tables(json!({
            "costs": [{ "id": 5 }],
            "maintenance_records": [{ "id": 1, "date": "2025-10-01", "cost_cents": 1 }],
        }));
        upgrade_tables(9, &mut with_costs);
        assert_eq!(with_costs["costs"].as_array().map(Vec::len), Some(2));

        let mut no_costs = tables(json!({ "investments": [] }));
        upgrade_tables(1, &mut no_costs);
        assert_eq!(Value::Object(no_costs), json!({ "investments": [] }));

        let mut odd = tables(json!({ "costs": {}, "maintenance_records": [{ "id": 1, "cost_cents": 1 }] }));
        upgrade_tables(9, &mut odd);
        assert_eq!(odd["costs"], json!({}));
    }

    #[test]
    fn renames_the_maintenance_costs_widget() {
        let mut old = tables(json!({
            "dashboard_widgets": [
                { "widget_type": "maintenance-costs", "settings": "{\"chartType\":\"line\"}" },
                { "widget_type": "maintenance-costs", "settings": "not json" },
                { "widget_type": "recent-objects", "settings": "{}" },
            ],
        }));

        upgrade_tables(9, &mut old);

        assert_eq!(
            old["dashboard_widgets"],
            json!([
                { "widget_type": "costs", "settings": "{\"chartType\":\"line\",\"costType\":\"maintenance\"}" },
                { "widget_type": "costs", "settings": "{\"costType\":\"maintenance\"}" },
                { "widget_type": "recent-objects", "settings": "{}" },
            ])
        );
    }

    #[test]
    fn leaves_current_exports_unchanged() {
        let current = json!({ "maintenance_records": [{ "id": 1, "cost_cents": 5 }] });
        let mut tables = tables(current.clone());
        upgrade_tables(COSTS_MOVED, &mut tables);
        assert_eq!(Value::Object(tables), current);
    }
}
