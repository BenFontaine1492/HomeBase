-- Finance management: every cost of the household in one table, the rules for
-- recurring costs, and the user-editable list of tax categories.
--
-- * cost_type says what the money was for; keep COST_TYPES in src/types/cost.ts
--   in sync with the CHECKs below. tax_category_id says how the user files it
--   for the tax return (optional). HomeBase gives no tax advice: it only stores
--   and exports what the user enters.
-- * labour_cents is the labour share of the amount (e.g. for tradesman services);
--   the form shows it only for categories with records_labour_cost = 1.
-- * payment_method: keep PAYMENT_METHODS in src/types/cost.ts in sync.
-- * A cost is linked to at most one household object, maintenance record or
--   investment (trigger below). A cost of a maintenance record belongs to it
--   (ON DELETE CASCADE, one cost per record); the other links are only
--   references (ON DELETE SET NULL), so tax data survives deleting an object.
-- * Recurring rules: next_due_date is the next occurrence that is not paid yet.
--   Confirming or skipping a payment moves it on by the interval; autopay rules
--   create their cost rows by themselves when due.
-- * Costs get receipts: attachments gets the owner column cost_id (recipe in 0005).
--
-- tax_categories has seed data: a frozen copy of DEFAULT_TAX_CATEGORIES in
-- src/types/tax-category.ts ("Add default categories"). German names, because
-- the export is meant for a German tax advisor.
-- Dates are 'YYYY-MM-DD'; `date(x) IS x` rejects anything else and allows NULL.

CREATE TABLE IF NOT EXISTS tax_categories (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0),
    records_labour_cost INTEGER NOT NULL DEFAULT 0 CHECK (records_labour_cost IN (0, 1)),
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

INSERT INTO tax_categories (name, records_labour_cost, sort_order) VALUES
    ('Haushaltsnahe Dienstleistungen', 1, 0),
    ('Handwerkerleistungen',           1, 1),
    ('Arbeitszimmer / Homeoffice',     0, 2),
    ('Versicherungen',                 0, 3),
    ('Spenden',                        0, 4),
    ('Krankheitskosten',               0, 5),
    ('Kinderbetreuung',                0, 6),
    ('Sonstiges',                      0, 7);

CREATE TABLE IF NOT EXISTS recurring_costs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    description         TEXT    NOT NULL CHECK (length(trim(description)) > 0),
    payee               TEXT,
    amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),
    labour_cents        INTEGER CHECK (labour_cents IS NULL OR (labour_cents >= 0 AND labour_cents <= amount_cents)),
    cost_type           TEXT    NOT NULL CHECK (
        cost_type IN ('maintenance', 'repair', 'purchase', 'insurance', 'energy', 'rent', 'subscription',
                      'service', 'tax', 'other')
    ),
    tax_category_id     INTEGER REFERENCES tax_categories (id) ON DELETE SET NULL,
    payment_method      TEXT    CHECK (
        payment_method IS NULL OR payment_method IN ('transfer', 'direct-debit', 'card', 'cash', 'other')
    ),
    household_object_id INTEGER REFERENCES household_objects (id) ON DELETE SET NULL,
    interval_value      INTEGER NOT NULL CHECK (interval_value BETWEEN 1 AND 3650),
    interval_unit       TEXT    NOT NULL CHECK (interval_unit IN ('day', 'week', 'month', 'year')),
    start_date          TEXT    NOT NULL CHECK (date(start_date) IS start_date),
    end_date            TEXT    CHECK (date(end_date) IS end_date),
    next_due_date       TEXT    NOT NULL CHECK (date(next_due_date) IS next_due_date),
    autopay             INTEGER NOT NULL DEFAULT 0 CHECK (autopay IN (0, 1)),
    notes               TEXT,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_recurring_costs_tax_category_id ON recurring_costs (tax_category_id);
CREATE INDEX IF NOT EXISTS idx_recurring_costs_household_object_id ON recurring_costs (household_object_id);

CREATE TABLE IF NOT EXISTS costs (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    paid_date             TEXT    NOT NULL CHECK (date(paid_date) IS paid_date),
    amount_cents          INTEGER NOT NULL CHECK (amount_cents >= 0),
    labour_cents          INTEGER CHECK (labour_cents IS NULL OR (labour_cents >= 0 AND labour_cents <= amount_cents)),
    cost_type             TEXT    NOT NULL CHECK (
        cost_type IN ('maintenance', 'repair', 'purchase', 'insurance', 'energy', 'rent', 'subscription',
                      'service', 'tax', 'other')
    ),
    -- NULL only for the cost of a maintenance record (its task or object names it).
    description           TEXT    CHECK (description IS NULL OR length(trim(description)) > 0),
    payee                 TEXT,
    payment_method        TEXT    CHECK (
        payment_method IS NULL OR payment_method IN ('transfer', 'direct-debit', 'card', 'cash', 'other')
    ),
    notes                 TEXT,
    tax_category_id       INTEGER REFERENCES tax_categories (id) ON DELETE SET NULL,
    household_object_id   INTEGER REFERENCES household_objects (id) ON DELETE SET NULL,
    maintenance_record_id INTEGER UNIQUE REFERENCES maintenance_records (id) ON DELETE CASCADE,
    investment_id         INTEGER REFERENCES investments (id) ON DELETE SET NULL,
    recurring_cost_id     INTEGER REFERENCES recurring_costs (id) ON DELETE SET NULL,
    created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CHECK (description IS NOT NULL OR maintenance_record_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_costs_paid_date ON costs (paid_date);
CREATE INDEX IF NOT EXISTS idx_costs_tax_category_id ON costs (tax_category_id);
CREATE INDEX IF NOT EXISTS idx_costs_household_object_id ON costs (household_object_id);
CREATE INDEX IF NOT EXISTS idx_costs_investment_id ON costs (investment_id);
CREATE INDEX IF NOT EXISTS idx_costs_recurring_cost_id ON costs (recurring_cost_id);

CREATE TRIGGER IF NOT EXISTS costs_one_link_insert
BEFORE INSERT ON costs
WHEN (NEW.household_object_id IS NOT NULL) + (NEW.maintenance_record_id IS NOT NULL)
     + (NEW.investment_id IS NOT NULL) > 1
BEGIN
    SELECT RAISE(ABORT, 'a cost is linked to at most one object, maintenance record or investment');
END;

CREATE TRIGGER IF NOT EXISTS costs_one_link_update
BEFORE UPDATE ON costs
WHEN (NEW.household_object_id IS NOT NULL) + (NEW.maintenance_record_id IS NOT NULL)
     + (NEW.investment_id IS NOT NULL) > 1
BEGIN
    SELECT RAISE(ABORT, 'a cost is linked to at most one object, maintenance record or investment');
END;

-- Receipts of a cost: a new attachment owner (recipe in 0005).
ALTER TABLE attachments ADD COLUMN cost_id INTEGER REFERENCES costs (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_attachments_cost_id ON attachments (cost_id);

DROP TRIGGER IF EXISTS attachments_one_owner_insert;
DROP TRIGGER IF EXISTS attachments_one_owner_update;

CREATE TRIGGER IF NOT EXISTS attachments_one_owner_insert
BEFORE INSERT ON attachments
WHEN (NEW.household_object_id IS NOT NULL) + (NEW.maintenance_record_id IS NOT NULL) + (NEW.cost_id IS NOT NULL) <> 1
BEGIN
    SELECT RAISE(ABORT, 'an attachment needs exactly one owner');
END;

CREATE TRIGGER IF NOT EXISTS attachments_one_owner_update
BEFORE UPDATE ON attachments
WHEN (NEW.household_object_id IS NOT NULL) + (NEW.maintenance_record_id IS NOT NULL) + (NEW.cost_id IS NOT NULL) <> 1
BEGIN
    SELECT RAISE(ABORT, 'an attachment needs exactly one owner');
END;
