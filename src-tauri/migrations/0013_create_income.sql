-- Income of the household (e.g. PV feed-in payments, rent, interest, a refund),
-- kept like the costs (0009) but in tables of their own, so the costs and their
-- export stay as they are.
--
-- * income_type says where the money came from; keep INCOME_TYPES in
--   src/types/income.ts in sync with the CHECKs below. payment_method uses the
--   same list as the costs (PAYMENT_METHODS in src/types/cost.ts).
-- * category is free text, like the name of an object attribute: the form
--   suggests DEFAULT_INCOME_CATEGORIES (src/types/income.ts) and the categories
--   used before. It only groups income for the export to a tax advisor;
--   HomeBase gives no tax advice.
-- * household_object_id is a reference only (ON DELETE SET NULL), so the data
--   survives deleting an object (e.g. the PV system).
-- * Recurring rules work like recurring_costs: next_due_date is the next
--   occurrence that is not recorded yet; autopay rules record their rows by
--   themselves when due. Deleting a rule keeps the income it recorded.
-- * Income gets documents (statements, settlements): attachments gets the owner
--   column income_id (recipe in 0005).
-- Dates are 'YYYY-MM-DD'; `date(x) IS x` rejects anything else and allows NULL.

CREATE TABLE IF NOT EXISTS recurring_income (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    description         TEXT    NOT NULL CHECK (length(trim(description)) > 0),
    payer               TEXT,
    amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),
    income_type         TEXT    NOT NULL CHECK (
        income_type IN ('feed-in', 'rent', 'interest', 'refund', 'sale', 'other')
    ),
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

CREATE INDEX IF NOT EXISTS idx_recurring_income_household_object_id ON recurring_income (household_object_id);

CREATE TABLE IF NOT EXISTS income (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    received_date       TEXT    NOT NULL CHECK (date(received_date) IS received_date),
    amount_cents        INTEGER NOT NULL CHECK (amount_cents >= 0),
    income_type         TEXT    NOT NULL CHECK (
        income_type IN ('feed-in', 'rent', 'interest', 'refund', 'sale', 'other')
    ),
    description         TEXT    NOT NULL CHECK (length(trim(description)) > 0),
    payer               TEXT,
    payment_method      TEXT    CHECK (
        payment_method IS NULL OR payment_method IN ('transfer', 'direct-debit', 'card', 'cash', 'other')
    ),
    category            TEXT    CHECK (category IS NULL OR length(trim(category)) > 0),
    notes               TEXT,
    household_object_id INTEGER REFERENCES household_objects (id) ON DELETE SET NULL,
    recurring_income_id INTEGER REFERENCES recurring_income (id) ON DELETE SET NULL,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_income_received_date ON income (received_date);
CREATE INDEX IF NOT EXISTS idx_income_household_object_id ON income (household_object_id);
CREATE INDEX IF NOT EXISTS idx_income_recurring_income_id ON income (recurring_income_id);

-- Documents of income: a new attachment owner (recipe in 0005).
ALTER TABLE attachments ADD COLUMN income_id INTEGER REFERENCES income (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_attachments_income_id ON attachments (income_id);

DROP TRIGGER IF EXISTS attachments_one_owner_insert;
DROP TRIGGER IF EXISTS attachments_one_owner_update;

CREATE TRIGGER IF NOT EXISTS attachments_one_owner_insert
BEFORE INSERT ON attachments
WHEN (NEW.household_object_id IS NOT NULL) + (NEW.maintenance_record_id IS NOT NULL) + (NEW.cost_id IS NOT NULL)
     + (NEW.income_id IS NOT NULL) <> 1
BEGIN
    SELECT RAISE(ABORT, 'an attachment needs exactly one owner');
END;

CREATE TRIGGER IF NOT EXISTS attachments_one_owner_update
BEFORE UPDATE ON attachments
WHEN (NEW.household_object_id IS NOT NULL) + (NEW.maintenance_record_id IS NOT NULL) + (NEW.cost_id IS NOT NULL)
     + (NEW.income_id IS NOT NULL) <> 1
BEGIN
    SELECT RAISE(ABORT, 'an attachment needs exactly one owner');
END;
