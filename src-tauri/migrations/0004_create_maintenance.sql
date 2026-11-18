-- Maintenance of household objects: recurring tasks and the history of what was done.
-- Both are child tables of household_objects and go away with their object.
--
-- The date a task was last done is NOT stored on the task. It is calculated
-- (src/types/maintenance-schedule.ts) as the later of
--   * maintenance_tasks.last_done_date: entered by hand, for maintenance done
--     before it was recorded in HomeBase (optional), and
--   * the newest maintenance_records.date of that task.
-- So editing or deleting a record can never leave a task with a wrong date.
--
-- Dates are 'YYYY-MM-DD' (date(x) IS x rejects anything else; "=" would let invalid dates
-- through, because date() returns NULL for them and a CHECK that is NULL passes).
-- Monetary values are integer cents.

CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    household_object_id INTEGER NOT NULL REFERENCES household_objects (id) ON DELETE CASCADE,
    name                TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
    -- "every interval_value interval_unit", e.g. 1 year, 1 month, 10 days.
    interval_value      INTEGER NOT NULL CHECK (interval_value BETWEEN 1 AND 3650),
    interval_unit       TEXT    NOT NULL CHECK (interval_unit IN ('day', 'week', 'month', 'year')),
    last_done_date      TEXT    CHECK (last_done_date IS NULL OR date(last_done_date) IS last_done_date),
    notes               TEXT,
    -- 0 = paused: kept, but not scheduled.
    active              INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    -- Also serves as the index for looking up an object's tasks.
    UNIQUE (household_object_id, name)
);

-- What was done and when. task_id is optional (a one-off repair has no task) and
-- becomes NULL when its task is deleted; the record itself stays in the history.
CREATE TABLE IF NOT EXISTS maintenance_records (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    household_object_id INTEGER NOT NULL REFERENCES household_objects (id) ON DELETE CASCADE,
    task_id             INTEGER REFERENCES maintenance_tasks (id) ON DELETE SET NULL,
    date                TEXT    NOT NULL CHECK (date(date) IS date),
    cost_cents          INTEGER CHECK (cost_cents IS NULL OR cost_cents >= 0),
    provider            TEXT,
    notes               TEXT,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_maintenance_records_household_object_id ON maintenance_records (household_object_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_task_id ON maintenance_records (task_id);

-- A record's task must belong to the same object as the record.
-- A task that doesn't exist (yet) is left to the foreign key: the JSON import
-- fills tables in alphabetical order and checks foreign keys at COMMIT.
CREATE TRIGGER IF NOT EXISTS maintenance_records_task_object_insert
BEFORE INSERT ON maintenance_records
WHEN NEW.task_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM maintenance_tasks WHERE id = NEW.task_id AND household_object_id <> NEW.household_object_id
)
BEGIN
    SELECT RAISE(ABORT, 'maintenance record and task belong to different objects');
END;

CREATE TRIGGER IF NOT EXISTS maintenance_records_task_object_update
BEFORE UPDATE OF household_object_id, task_id ON maintenance_records
WHEN NEW.task_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM maintenance_tasks WHERE id = NEW.task_id AND household_object_id <> NEW.household_object_id
)
BEGIN
    SELECT RAISE(ABORT, 'maintenance record and task belong to different objects');
END;
