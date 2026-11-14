-- Planned household investments (future purchases).
-- Monetary values are stored as integer cents to avoid floating point errors.
CREATE TABLE IF NOT EXISTS investments (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    title                TEXT    NOT NULL CHECK (length(trim(title)) > 0),
    description          TEXT,
    estimated_cost_cents INTEGER NOT NULL CHECK (estimated_cost_cents >= 0),
    priority             TEXT    NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
    sort_order           INTEGER NOT NULL DEFAULT 0,
    created_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_investments_sort_order ON investments (sort_order);
