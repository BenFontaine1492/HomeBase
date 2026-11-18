-- Documents (invoices, manuals, photos, …) attached to a household object or to
-- a maintenance record. The files are copied into the attachments/ folder next
-- to the database under stored_name; this table holds only their metadata.
-- Files without a row are removed by the native startup cleanup
-- (src-tauri/src/attachments/).
--
-- Owner: exactly one owner column is set ("exclusive arc"). Each owner has a
-- real foreign key, so deleting the owner deletes its attachment rows.
-- The rule is a trigger, not a table CHECK, because SQLite can't change a CHECK
-- without rebuilding the table. To add an owner (e.g. expense_id) in a later
-- migration:
--   1. ALTER TABLE attachments ADD COLUMN expense_id INTEGER REFERENCES expenses (id) ON DELETE CASCADE;
--   2. CREATE INDEX for the new column;
--   3. DROP both attachments_one_owner_* triggers and create them again with the
--      new column added to the sum.
-- Dates are 'YYYY-MM-DD'.

CREATE TABLE IF NOT EXISTS attachments (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    household_object_id   INTEGER REFERENCES household_objects (id) ON DELETE CASCADE,
    maintenance_record_id INTEGER REFERENCES maintenance_records (id) ON DELETE CASCADE,
    -- Unique file name inside attachments/, e.g. '18f3a2b4c5d6e7f8-0.pdf'.
    stored_name           TEXT    NOT NULL UNIQUE CHECK (length(stored_name) > 0),
    -- The file name the user picked, e.g. 'invoice-heatpump.pdf'.
    original_name         TEXT    NOT NULL CHECK (length(trim(original_name)) > 0),
    mime_type             TEXT    NOT NULL,
    size_bytes            INTEGER NOT NULL CHECK (size_bytes >= 0),
    document_type         TEXT    NOT NULL CHECK (
        document_type IN ('invoice', 'receipt', 'contract', 'manual', 'warranty', 'photo', 'other')
    ),
    document_date         TEXT    CHECK (document_date IS NULL OR date(document_date) IS document_date),
    notes                 TEXT,
    created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_attachments_household_object_id ON attachments (household_object_id);
CREATE INDEX IF NOT EXISTS idx_attachments_maintenance_record_id ON attachments (maintenance_record_id);

CREATE TRIGGER IF NOT EXISTS attachments_one_owner_insert
BEFORE INSERT ON attachments
WHEN (NEW.household_object_id IS NOT NULL) + (NEW.maintenance_record_id IS NOT NULL) <> 1
BEGIN
    SELECT RAISE(ABORT, 'an attachment needs exactly one owner');
END;

CREATE TRIGGER IF NOT EXISTS attachments_one_owner_update
BEFORE UPDATE ON attachments
WHEN (NEW.household_object_id IS NOT NULL) + (NEW.maintenance_record_id IS NOT NULL) <> 1
BEGIN
    SELECT RAISE(ABORT, 'an attachment needs exactly one owner');
END;
