-- Projects group the investments (e.g. "Renovate the house", "Restore the car").
-- Every investment belongs to exactly one project and is deleted with it; the
-- projects' sort_order is the order in which the savings roadmap funds them, the
-- investments' sort_order now orders the planned investments within their project.
--
-- * investments gets project_id by ADD COLUMN, not by a rebuild: dropping the old
--   table would clear costs.investment_id. SQLite can't add a NOT NULL foreign key
--   column, so two triggers require it.
-- * Existing investments move into one default project, named in the language of
--   Settings -> General (German when it isn't set). Without investments there is none.

CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL CHECK (length(trim(name)) > 0),
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name ON projects (lower(trim(name)));
CREATE INDEX IF NOT EXISTS idx_projects_sort_order ON projects (sort_order);

ALTER TABLE investments ADD COLUMN project_id INTEGER REFERENCES projects (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_investments_project_id ON investments (project_id);

INSERT INTO projects (name, sort_order)
SELECT CASE WHEN (SELECT value FROM settings WHERE key = 'general.language') = 'en' THEN 'General' ELSE 'Allgemein' END, 1
 WHERE EXISTS (SELECT 1 FROM investments);

UPDATE investments SET project_id = (SELECT MIN(id) FROM projects);

CREATE TRIGGER IF NOT EXISTS investments_project_required_insert
BEFORE INSERT ON investments
WHEN NEW.project_id IS NULL
BEGIN
    SELECT RAISE(ABORT, 'investments need a project');
END;

CREATE TRIGGER IF NOT EXISTS investments_project_required_update
BEFORE UPDATE OF project_id ON investments
WHEN NEW.project_id IS NULL
BEGIN
    SELECT RAISE(ABORT, 'investments need a project');
END;
