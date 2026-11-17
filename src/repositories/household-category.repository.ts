import { execute, select, transaction } from '@/infrastructure/database'
import { insertedId, rethrowConstraintError } from './repository-errors'
import type { DeleteCategoryOptions, HouseholdCategory, HouseholdCategoryValues } from '@/types/household-category'

/** Row shape as stored in SQLite (snake_case columns). */
interface HouseholdCategoryRow {
  id: number
  name: string
  icon: string
  description: string | null
  created_at: string
  updated_at: string
}

function mapRow(row: HouseholdCategoryRow): HouseholdCategory {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function findAll(): Promise<HouseholdCategory[]> {
  const rows = await select<HouseholdCategoryRow>(
    `SELECT id, name, icon, description, created_at, updated_at
       FROM household_categories
      ORDER BY name COLLATE NOCASE ASC, id ASC`,
  )
  return rows.map(mapRow)
}

/** Inserts a category and returns its id. A taken name throws `DuplicateValueError`. */
export async function insert(values: HouseholdCategoryValues): Promise<number> {
  const result = await execute(`INSERT INTO household_categories (name, icon, description) VALUES ($1, $2, $3)`, [
    values.name,
    values.icon,
    values.description,
  ]).catch(rethrowConstraintError)
  return insertedId(result, 'category')
}

/** false = no such category. A taken name throws `DuplicateValueError`. */
export async function update(id: number, values: HouseholdCategoryValues): Promise<boolean> {
  const result = await execute(
    `UPDATE household_categories
        SET name = $1,
            icon = $2,
            description = $3,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $4`,
    [values.name, values.icon, values.description, id],
  ).catch(rethrowConstraintError)
  return result.rowsAffected > 0
}

/**
 * Deletes a category in one transaction. Its objects are deleted as well, or kept
 * with `category_id = NULL` ("No category assigned"). They are handled explicitly,
 * so the result doesn't depend on the connection's `foreign_keys` pragma.
 * false = no such category (nothing is changed then).
 */
export async function remove(id: number, options: DeleteCategoryOptions): Promise<boolean> {
  const results = await transaction([
    options.deleteObjects
      ? { sql: 'DELETE FROM household_objects WHERE category_id = $1', params: [id] }
      : {
          sql: `UPDATE household_objects
                   SET category_id = NULL,
                       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                 WHERE category_id = $1`,
          params: [id],
        },
    { sql: 'DELETE FROM household_categories WHERE id = $1', params: [id] },
  ])
  // One result per statement, so the category's result is always there.
  return results[1]!.rowsAffected > 0
}
