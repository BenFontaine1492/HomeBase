-- App settings as key/value pairs. A missing key means "use the default", so
-- new settings need no migration. Values are canonical text; the frontend
-- (src/types/settings.ts) parses them and falls back to the default for any
-- value it can't read.
-- Example: 'maintenance.due_soon_days' = '60'.

CREATE TABLE IF NOT EXISTS settings (
    key        TEXT NOT NULL PRIMARY KEY CHECK (length(trim(key)) > 0),
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
