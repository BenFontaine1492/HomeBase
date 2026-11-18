-- The widgets of the dashboard (the start page), in display order.
--
-- * widget_type has deliberately no CHECK ... IN (...): later features add their
--   own widget types, and SQLite can't change a CHECK without rebuilding the
--   table. The frontend (WIDGET_TYPES in src/types/dashboard.ts) checks the type
--   and shows a placeholder for types it doesn't know (e.g. from a newer backup).
-- * settings is a JSON object because it differs per widget type and is never
--   searched. A value the frontend can't read falls back to the type's defaults.
-- * The layout is always saved as a whole (DELETE + INSERT in one transaction),
--   so position stays unique without renumbering.
--
-- Unlike the other tables, this one has seed data: the default layout of a new
-- installation. It is a frozen copy of DEFAULT_DASHBOARD in src/types/dashboard.ts
-- ("Reset to default"); a later change of the defaults there doesn't need a new
-- migration.

CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    widget_type TEXT    NOT NULL CHECK (length(trim(widget_type)) > 0),
    position    INTEGER NOT NULL UNIQUE CHECK (position >= 0),
    size        TEXT    NOT NULL CHECK (size IN ('small', 'medium', 'large')),
    -- NULL = the widget type's default title.
    title       TEXT    CHECK (title IS NULL OR length(trim(title)) > 0),
    settings    TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(settings) AND json_type(settings) = 'object'),
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

INSERT INTO dashboard_widgets (widget_type, position, size, settings) VALUES
    ('upcoming-maintenance', 0, 'medium', '{}'),
    ('recent-objects',       1, 'medium', '{}'),
    ('maintenance-costs',    2, 'large',  '{"chartType":"bar","timeRange":"last-5-years"}');
