//! Brings the tables of an older JSON export up to this app's schema before they
//! are imported. Backups need no such step: a restored database runs the
//! migrations. An export holds rows only, so what a migration did to the data is
//! done here again, on the JSON.

use std::collections::HashMap;

use serde_json::{json, Map, Value};

/// The schema version (migration 0010) that moved `maintenance_records.cost_cents`
/// into `costs` and renamed the "maintenance-costs" widget to "costs".
const COSTS_MOVED: i64 = 10;

/// The schema version (migration 0014) that replaced the cost and income types, the
/// tax categories and the labour share by one category per cost or income entry.
const CATEGORIES: i64 = 14;

/// The names of the old cost types (code, German, English), as in migration 0014.
const COST_TYPE_NAMES: [(&str, &str, &str); 10] = [
    ("maintenance", "Wartung", "Maintenance"),
    ("repair", "Reparatur", "Repair"),
    ("purchase", "Anschaffung", "Purchase"),
    ("insurance", "Versicherungen", "Insurance"),
    ("energy", "Energie", "Energy"),
    ("rent", "Miete", "Rent"),
    ("subscription", "Abonnement", "Subscription"),
    ("service", "Dienstleistung", "Service"),
    ("tax", "Steuern und Abgaben", "Taxes and fees"),
    ("other", "Sonstiges", "Other"),
];

/// The names of the old income types (code, German, English), as in migration 0014.
const INCOME_TYPE_NAMES: [(&str, &str, &str); 6] = [
    ("feed-in", "Photovoltaik", "Solar power"),
    ("rent", "Vermietung und Verpachtung", "Rental income"),
    ("interest", "Kapitalerträge", "Interest and dividends"),
    ("refund", "Erstattungen", "Refunds"),
    ("sale", "Verkäufe", "Sales"),
    ("other", "Sonstige Einnahmen", "Other income"),
];

/// Upgrades `tables` of an export made with schema `schema_version`, in place.
pub(super) fn upgrade_tables(schema_version: i64, tables: &mut Map<String, Value>) {
    if schema_version < COSTS_MOVED {
        move_maintenance_costs(tables);
        rename_cost_widgets(tables);
    }
    if schema_version < CATEGORIES {
        use_categories(tables);
    }
}

/// The rows of `table` (every row is an object, see `parse_export`); none if it is missing.
fn rows_mut<'a>(tables: &'a mut Map<String, Value>, table: &str) -> impl Iterator<Item = &'a mut Map<String, Value>> {
    tables.get_mut(table).and_then(Value::as_array_mut).into_iter().flatten().filter_map(Value::as_object_mut)
}

/// The settings of a widget row as an object (empty if they can't be read).
fn settings_of(widget: &Map<String, Value>) -> Map<String, Value> {
    widget.get("settings").and_then(Value::as_str).and_then(|text| serde_json::from_str(text).ok()).unwrap_or_default()
}

fn set_settings(widget: &mut Map<String, Value>, settings: Map<String, Value>) {
    widget.insert("settings".into(), json!(Value::Object(settings).to_string()));
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
        let mut settings = settings_of(widget);
        settings.insert("costType".into(), json!("maintenance"));
        widget.insert("widget_type".into(), json!("costs"));
        set_settings(widget, settings);
    }
}

/// Whether the export's UI language is English (else the names are German, like migration 0014).
fn is_english(tables: &mut Map<String, Value>) -> bool {
    rows_mut(tables, "settings").any(|row| {
        row.get("key").and_then(Value::as_str) == Some("general.language")
            && row.get("value").and_then(Value::as_str) == Some("en")
    })
}

/// The name of type `code` in `names`; null for an unknown or missing type.
fn type_name(names: &[(&str, &str, &str)], code: Option<&Value>, english: bool) -> Value {
    let code = code.and_then(Value::as_str);
    let found = names.iter().find(|(candidate, _, _)| Some(*candidate) == code);
    found.map_or(Value::Null, |(_, german, english_name)| json!(if english { english_name } else { german }))
}

fn tax_category_entry(row: &mut Map<String, Value>) -> Option<(i64, Value)> {
    Some((row.get("id")?.as_i64()?, row.get("name")?.clone()))
}

/// The names of the tax categories by id; the table itself is removed.
fn take_tax_categories(tables: &mut Map<String, Value>) -> HashMap<i64, Value> {
    let names = rows_mut(tables, "tax_categories").filter_map(tax_category_entry).collect();
    tables.remove("tax_categories");
    names
}

/// Like migration 0014: a cost's (or rule's) category is its tax category, else its type.
fn categorise_costs(tables: &mut Map<String, Value>, table: &str, tax_categories: &HashMap<i64, Value>, english: bool) {
    for row in rows_mut(tables, table) {
        let tax_category_id = row.remove("tax_category_id").as_ref().and_then(Value::as_i64);
        let tax_category = tax_category_id.and_then(|id| tax_categories.get(&id).cloned());
        let cost_type = row.remove("cost_type");
        row.remove("labour_cents");
        let category = match tax_category {
            Some(name) => name,
            None => type_name(&COST_TYPE_NAMES, cost_type.as_ref(), english),
        };
        row.insert("category".into(), category);
    }
}

/// Like migration 0014: income without a category gets its type's name.
fn categorise_income(tables: &mut Map<String, Value>, table: &str, english: bool) {
    for row in rows_mut(tables, table) {
        let income_type = row.remove("income_type");
        if row.get("category").and_then(Value::as_str).is_none() {
            row.insert("category".into(), type_name(&INCOME_TYPE_NAMES, income_type.as_ref(), english));
        }
    }
}

/// Like migration 0014: the cost type filter becomes a category filter; the tax categories widget a costs widget.
fn categorise_widgets(tables: &mut Map<String, Value>, english: bool) {
    for widget in rows_mut(tables, "dashboard_widgets") {
        match widget.get("widget_type").and_then(Value::as_str) {
            Some("tax-categories") => {
                widget.insert("widget_type".into(), json!("costs"));
            }
            Some("costs") => {
                let mut settings = settings_of(widget);
                let cost_type = settings.remove("costType").unwrap_or(Value::Null);
                if !cost_type.is_null() {
                    settings.insert("costCategory".into(), type_name(&COST_TYPE_NAMES, Some(&cost_type), english));
                }
                set_settings(widget, settings);
            }
            _ => {}
        }
    }
}

fn use_categories(tables: &mut Map<String, Value>) {
    let english = is_english(tables);
    let tax_categories = take_tax_categories(tables);
    categorise_costs(tables, "costs", &tax_categories, english);
    categorise_costs(tables, "recurring_costs", &tax_categories, english);
    categorise_income(tables, "income", english);
    categorise_income(tables, "recurring_income", english);
    categorise_widgets(tables, english);
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
                    "category": "Wartung",
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
                { "widget_type": "costs", "settings": "{\"chartType\":\"line\",\"costCategory\":\"Wartung\"}" },
                { "widget_type": "costs", "settings": "{\"costCategory\":\"Wartung\"}" },
                { "widget_type": "recent-objects", "settings": "{}" },
            ])
        );
    }

    #[test]
    fn turns_types_and_tax_categories_into_categories() {
        let mut old = tables(json!({
            "tax_categories": [{ "id": 2, "name": "Handwerkerleistungen" }, { "id": 3 }],
            "costs": [
                { "id": 1, "cost_type": "repair", "tax_category_id": 2, "labour_cents": 300 },
                { "id": 2, "cost_type": "insurance", "tax_category_id": null, "labour_cents": null },
                { "id": 3, "cost_type": "unknown", "tax_category_id": 3 },
            ],
            "recurring_costs": [{ "id": 1, "cost_type": "tax" }],
            "income": [
                { "id": 1, "income_type": "feed-in", "category": null },
                { "id": 2, "income_type": "rent", "category": "Wohnung" },
                { "id": 3 },
            ],
            "recurring_income": [{ "id": 1, "income_type": "interest" }],
            "dashboard_widgets": [
                { "widget_type": "costs", "settings": "{\"costType\":\"energy\",\"chartType\":\"bar\"}" },
                { "widget_type": "costs", "settings": "{\"costType\":null}" },
                { "widget_type": "tax-categories", "settings": "{\"chartType\":\"pie\"}" },
                { "widget_type": "recent-objects", "settings": "{}" },
            ],
        }));

        upgrade_tables(13, &mut old);

        assert_eq!(
            Value::Object(old),
            json!({
                "costs": [
                    { "id": 1, "category": "Handwerkerleistungen" },
                    { "id": 2, "category": "Versicherungen" },
                    { "id": 3, "category": null },
                ],
                "recurring_costs": [{ "id": 1, "category": "Steuern und Abgaben" }],
                "income": [
                    { "id": 1, "category": "Photovoltaik" },
                    { "id": 2, "category": "Wohnung" },
                    { "id": 3, "category": null },
                ],
                "recurring_income": [{ "id": 1, "category": "Kapitalerträge" }],
                "dashboard_widgets": [
                    { "widget_type": "costs", "settings": "{\"chartType\":\"bar\",\"costCategory\":\"Energie\"}" },
                    { "widget_type": "costs", "settings": "{}" },
                    { "widget_type": "costs", "settings": "{\"chartType\":\"pie\"}" },
                    { "widget_type": "recent-objects", "settings": "{}" },
                ],
            })
        );
    }

    #[test]
    fn names_the_types_in_english_for_an_english_ui() {
        let mut old = tables(json!({
            "settings": [
                { "key": "general.theme", "value": "dark" },
                { "key": "general.language", "value": "en" },
            ],
            "costs": [{ "id": 1, "cost_type": "insurance" }],
            "income": [{ "id": 1, "income_type": "refund" }],
        }));

        upgrade_tables(13, &mut old);

        assert_eq!(old["costs"], json!([{ "id": 1, "category": "Insurance" }]));
        assert_eq!(old["income"], json!([{ "id": 1, "category": "Refunds" }]));
    }

    #[test]
    fn leaves_current_exports_unchanged() {
        let current = json!({
            "maintenance_records": [{ "id": 1, "cost_cents": 5 }],
            "costs": [{ "id": 1, "cost_type": "repair" }],
        });
        let mut tables = tables(current.clone());
        upgrade_tables(CATEGORIES, &mut tables);
        assert_eq!(Value::Object(tables), current);
    }
}
