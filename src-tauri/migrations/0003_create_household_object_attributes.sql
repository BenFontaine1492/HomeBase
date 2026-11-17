-- User-defined attributes of a household object, one row per attribute
-- (e.g. "Power" = '12.5' kW, "Refrigerant" = 'R290').
-- The object form saves an object's attributes as a whole (delete + insert in
-- one transaction), so rows have no timestamps of their own.
--
-- value holds the canonical text of the value_type:
--   text    -> as entered (trimmed)
--   number  -> decimal with a dot, e.g. '12.5' (unit only for numbers)
--   date    -> 'YYYY-MM-DD'
--   boolean -> '1' or '0'
-- NULL = no value entered yet.

CREATE TABLE IF NOT EXISTS household_object_attributes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    household_object_id INTEGER NOT NULL REFERENCES household_objects (id) ON DELETE CASCADE,
    name                TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
    value_type          TEXT    NOT NULL CHECK (value_type IN ('text', 'number', 'date', 'boolean')),
    value               TEXT,
    unit                TEXT,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    -- Also serves as the index for looking up an object's attributes.
    UNIQUE (household_object_id, name)
);
