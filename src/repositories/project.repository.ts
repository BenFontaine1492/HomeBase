import { execute, select, transaction } from '@/infrastructure/database'
import { insertedId, rethrowConstraintError } from './repository-errors'
import type { Project, ProjectOrder, ProjectValues } from '@/types/project'

/** Row shape as stored in SQLite (snake_case columns). */
interface ProjectRow {
  id: number
  name: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

function mapRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function findAll(): Promise<Project[]> {
  const rows = await select<ProjectRow>(
    `SELECT id, name, description, sort_order, created_at, updated_at
       FROM projects
      ORDER BY sort_order ASC, id ASC`,
  )
  return rows.map(mapRow)
}

/** Inserts a project at the end of the list and returns its id. A taken name throws `DuplicateValueError`. */
export async function insert(values: ProjectValues): Promise<number> {
  const result = await execute(
    `INSERT INTO projects (name, description, sort_order)
     VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM projects))`,
    [values.name, values.description],
  ).catch(rethrowConstraintError)
  return insertedId(result, 'project')
}

/** Updates name and description; the position is kept. false = no such project. A taken name throws `DuplicateValueError`. */
export async function update(id: number, values: ProjectValues): Promise<boolean> {
  const result = await execute(
    `UPDATE projects
        SET name = $1,
            description = $2,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $3`,
    [values.name, values.description, id],
  ).catch(rethrowConstraintError)
  return result.rowsAffected > 0
}

/** Gives the listed projects the positions 1, 2, … in one transaction. Others keep theirs. */
export async function reorder(order: ProjectOrder): Promise<void> {
  await transaction(
    order.ids.map((id, index) => ({
      sql: 'UPDATE projects SET sort_order = $1 WHERE id = $2',
      params: [index + 1, id],
    })),
  )
}

/**
 * Deletes a project and its investments in one transaction (explicitly, so it doesn't
 * depend on the connection's `foreign_keys` pragma). false = no such project.
 */
export async function remove(id: number): Promise<boolean> {
  const results = await transaction([
    { sql: 'DELETE FROM investments WHERE project_id = $1', params: [id] },
    { sql: 'DELETE FROM projects WHERE id = $1', params: [id] },
  ])
  // One result per statement, so the project's result is always there.
  return results[1]!.rowsAffected > 0
}
