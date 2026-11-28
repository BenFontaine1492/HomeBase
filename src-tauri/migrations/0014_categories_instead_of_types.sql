-- Costs and income are filed under one category each, a free text like the name of
-- an object attribute: the forms suggest a default list (in the UI language) and
-- the categories used before. It replaces the fixed types (costs.cost_type,
-- income.income_type), the user-editable tax categories (tax_categories,
-- costs.tax_category_id) and the labour share (labour_cents), which are dropped.
-- HomeBase gives no tax advice: the category only groups entries for the export.
--
-- * A cost's category is its tax category's name, else its type's name; income's
--   is its category, else its type's name. The type names are those of the
--   default lists (DEFAULT_COST_CATEGORIES / DEFAULT_INCOME_CATEGORIES), in the
--   language of Settings → General (German when it isn't set).
-- * The "Costs" widget's cost type filter becomes a category filter; the
--   "Tax categories" widget becomes a "Costs" widget (split by category).
-- * costs and recurring_costs are rebuilt (SQLite can't drop a foreign key
--   column). Foreign keys may be on during migrations, so the old tables are only
--   dropped once nothing refers to them: the documents of costs are unlinked
--   meanwhile (their one-owner trigger is off) and linked again afterwards, and
--   the new costs refer to the new rules table from the start.
-- Dates are 'YYYY-MM-DD'; `date(x) IS x` rejects anything else and allows NULL.

-- The names of the old types, in the user's language. Dropped at the end.
CREATE TABLE category_names (
    kind TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    en   TEXT NOT NULL,
    PRIMARY KEY (kind, code)
);

INSERT INTO category_names (kind, code, name, en) VALUES
    ('cost',   'maintenance',  'Wartung',                    'Maintenance'),
    ('cost',   'repair',       'Reparatur',                  'Repair'),
    ('cost',   'purchase',     'Anschaffung',                'Purchase'),
    ('cost',   'insurance',    'Versicherungen',             'Insurance'),
    ('cost',   'energy',       'Energie',                    'Energy'),
    ('cost',   'rent',         'Miete',                      'Rent'),
    ('cost',   'subscription', 'Abonnement',                 'Subscription'),
    ('cost',   'service',      'Dienstleistung',             'Service'),
    ('cost',   'tax',          'Steuern und Abgaben',        'Taxes and fees'),
    ('cost',   'other',        'Sonstiges',                  'Other'),
    ('income', 'feed-in',      'Photovoltaik',               'Solar power'),
    ('income', 'rent',         'Vermietung und Verpachtung', 'Rental income'),
    ('income', 'interest',     'Kapitalerträge',             'Interest and dividends'),
    ('income', 'refund',       'Erstattungen',               'Refunds'),
    ('income', 'sale',         'Verkäufe',                   'Sales'),
    ('income', 'other',        'Sonstige Einnahmen',         'Other income');

UPDATE category_names
   SET name = en
 WHERE (SELECT value FROM settings WHERE key = 'general.language') = 'en';

-- Income: the type becomes the category where there is none.
UPDATE income
   SET category = (SELECT name FROM category_names WHERE kind = 'income' AND code = income.income_type)
 WHERE category IS NULL;

UPDATE recurring_income
   SET category = (SELECT name FROM category_names WHERE kind = 'income' AND code = recurring_income.income_type)
 WHERE category IS NULL;

ALTER TABLE income DROP COLUMN income_type;
ALTER TABLE recurring_income DROP COLUMN income_type;

-- Costs and their rules, rebuilt with a category instead of type, tax category and labour share.
CREATE TABLE recurring_costs_new (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    description         TEXT    NOT NULL CHECK (length(trim(description)) > 0),
    payee               TEXT,
    amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),
    category            TEXT    CHECK (category IS NULL OR length(trim(category)) > 0),
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

INSERT INTO recurring_costs_new (id, description, payee, amount_cents, category, payment_method,
                                 household_object_id, interval_value, interval_unit, start_date, end_date,
                                 next_due_date, autopay, notes, created_at, updated_at)
SELECT r.id, r.description, r.payee, r.amount_cents,
       coalesce((SELECT name FROM tax_categories WHERE id = r.tax_category_id),
                (SELECT name FROM category_names WHERE kind = 'cost' AND code = r.cost_type)),
       r.payment_method, r.household_object_id, r.interval_value, r.interval_unit, r.start_date, r.end_date,
       r.next_due_date, r.autopay, r.notes, r.created_at, r.updated_at
  FROM recurring_costs r;

CREATE TABLE costs_new (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    paid_date             TEXT    NOT NULL CHECK (date(paid_date) IS paid_date),
    amount_cents          INTEGER NOT NULL CHECK (amount_cents >= 0),
    category              TEXT    CHECK (category IS NULL OR length(trim(category)) > 0),
    -- NULL only for the cost of a maintenance record (its task or object names it).
    description           TEXT    CHECK (description IS NULL OR length(trim(description)) > 0),
    payee                 TEXT,
    payment_method        TEXT    CHECK (
        payment_method IS NULL OR payment_method IN ('transfer', 'direct-debit', 'card', 'cash', 'other')
    ),
    notes                 TEXT,
    household_object_id   INTEGER REFERENCES household_objects (id) ON DELETE SET NULL,
    maintenance_record_id INTEGER UNIQUE REFERENCES maintenance_records (id) ON DELETE CASCADE,
    investment_id         INTEGER REFERENCES investments (id) ON DELETE SET NULL,
    -- Renamed to recurring_costs below (the reference follows the rename).
    recurring_cost_id     INTEGER REFERENCES recurring_costs_new (id) ON DELETE SET NULL,
    created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CHECK (description IS NOT NULL OR maintenance_record_id IS NOT NULL)
);

INSERT INTO costs_new (id, paid_date, amount_cents, category, description, payee, payment_method, notes,
                       household_object_id, maintenance_record_id, investment_id, recurring_cost_id,
                       created_at, updated_at)
SELECT c.id, c.paid_date, c.amount_cents,
       coalesce((SELECT name FROM tax_categories WHERE id = c.tax_category_id),
                (SELECT name FROM category_names WHERE kind = 'cost' AND code = c.cost_type)),
       c.description, c.payee, c.payment_method, c.notes, c.household_object_id, c.maintenance_record_id,
       c.investment_id, c.recurring_cost_id, c.created_at, c.updated_at
  FROM costs c;

-- Unlink the documents of costs, so dropping the old table doesn't delete them (ON DELETE CASCADE).
CREATE TABLE cost_documents AS SELECT id, cost_id FROM attachments WHERE cost_id IS NOT NULL;
DROP TRIGGER IF EXISTS attachments_one_owner_update;
UPDATE attachments SET cost_id = NULL WHERE cost_id IS NOT NULL;

DROP TABLE costs;
DROP TABLE recurring_costs;
ALTER TABLE recurring_costs_new RENAME TO recurring_costs;
ALTER TABLE costs_new RENAME TO costs;

UPDATE attachments
   SET cost_id = (SELECT cost_id FROM cost_documents WHERE cost_documents.id = attachments.id)
 WHERE id IN (SELECT id FROM cost_documents);
DROP TABLE cost_documents;

CREATE TRIGGER IF NOT EXISTS attachments_one_owner_update
BEFORE UPDATE ON attachments
WHEN (NEW.household_object_id IS NOT NULL) + (NEW.maintenance_record_id IS NOT NULL) + (NEW.cost_id IS NOT NULL)
     + (NEW.income_id IS NOT NULL) <> 1
BEGIN
    SELECT RAISE(ABORT, 'an attachment needs exactly one owner');
END;

CREATE INDEX IF NOT EXISTS idx_recurring_costs_household_object_id ON recurring_costs (household_object_id);
CREATE INDEX IF NOT EXISTS idx_costs_paid_date ON costs (paid_date);
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

-- Dashboard: the cost type filter becomes a category filter; the tax categories widget a costs widget.
UPDATE dashboard_widgets
   SET settings = json_remove(
           json_set(settings, '$.costCategory',
                    (SELECT name FROM category_names
                      WHERE kind = 'cost' AND code = json_extract(dashboard_widgets.settings, '$.costType'))),
           '$.costType')
 WHERE widget_type = 'costs' AND json_extract(settings, '$.costType') IS NOT NULL;

UPDATE dashboard_widgets
   SET settings = json_remove(settings, '$.costType')
 WHERE widget_type = 'costs';

UPDATE dashboard_widgets
   SET widget_type = 'costs'
 WHERE widget_type = 'tax-categories';

DROP TABLE tax_categories;
DROP TABLE category_names;
