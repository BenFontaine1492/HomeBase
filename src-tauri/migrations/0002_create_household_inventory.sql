-- Household inventory: user-defined categories and the objects assigned to them.
-- No seed data: the user creates every category and object.
-- An object without a category (category_id IS NULL) is valid; the UI shows it
-- as "No category assigned".

CREATE TABLE IF NOT EXISTS household_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0),
    icon        TEXT    NOT NULL,
    description TEXT,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Dates are stored as 'YYYY-MM-DD'. Monetary values are stored as integer cents.
CREATE TABLE IF NOT EXISTS household_objects (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    name                 TEXT    NOT NULL CHECK (length(trim(name)) > 0),
    category_id          INTEGER REFERENCES household_categories (id) ON DELETE SET NULL,
    manufacturer         TEXT,
    model                TEXT,
    serial_number        TEXT,
    purchase_date        TEXT,
    purchase_price_cents INTEGER CHECK (purchase_price_cents IS NULL OR purchase_price_cents >= 0),
    installation_date    TEXT,
    location             TEXT,
    notes                TEXT,
    created_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_household_objects_category_id ON household_objects (category_id);
