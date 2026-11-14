import { execute, select } from './database/database.service'
import { describeError } from './database/database-error'
import { CATEGORY_ICONS, type HouseholdCategory, type HouseholdCategoryInput } from '@/types/household-category'

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

function validate(input: HouseholdCategoryInput): void {
  if (input.name.trim().length === 0) {
    throw new Error('A category needs a name.')
  }
  if (!CATEGORY_ICONS.some((option) => option.icon === input.icon)) {
    throw new Error(`Unknown icon "${input.icon}".`)
  }
}

function normaliseDescription(description: string | null | undefined): string | null {
  return description?.trim() || null
}

/** Turns the SQLite UNIQUE violation on `name` into a readable message. */
function rethrowDuplicateName(error: unknown): never {
  if (describeError(error).includes('UNIQUE constraint failed')) {
    throw new Error('A category with this name already exists.')
  }
  throw error
}

export async function listCategories(): Promise<HouseholdCategory[]> {
  const rows = await select<HouseholdCategoryRow>(
    `SELECT id, name, icon, description, created_at, updated_at
       FROM household_categories
      ORDER BY name COLLATE NOCASE ASC, id ASC`,
  )
  return rows.map(mapRow)
}

/** Inserts a new category and returns its id. */
export async function createCategory(input: HouseholdCategoryInput): Promise<number> {
  validate(input)
  const result = await execute(
    `INSERT INTO household_categories (name, icon, description) VALUES ($1, $2, $3)`,
    [input.name.trim(), input.icon, normaliseDescription(input.description)],
  ).catch(rethrowDuplicateName)
  if (result.lastInsertId === undefined) {
    throw new Error('The database did not return an id for the new category.')
  }
  return result.lastInsertId
}

export async function updateCategory(id: number, input: HouseholdCategoryInput): Promise<void> {
  validate(input)
  const result = await execute(
    `UPDATE household_categories
        SET name = $1,
            icon = $2,
            description = $3,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $4`,
    [input.name.trim(), input.icon, normaliseDescription(input.description), id],
  ).catch(rethrowDuplicateName)
  if (result.rowsAffected === 0) {
    throw new Error('This category no longer exists.')
  }
}

export interface DeleteCategoryOptions {
  /** true: delete the assigned objects too. false: keep them without a category. */
  deleteObjects: boolean
}

/**
 * Deletes a category. Its objects are either deleted as well or kept with
 * `category_id = NULL` ("No category assigned").
 *
 * The objects are handled explicitly first, so the result does not depend on
 * the connection's `foreign_keys` pragma. If the second statement fails, the
 * category still exists and the operation can simply be retried.
 */
export async function deleteCategory(id: number, options: DeleteCategoryOptions): Promise<void> {
  if (options.deleteObjects) {
    await execute('DELETE FROM household_objects WHERE category_id = $1', [id])
  } else {
    await execute(
      `UPDATE household_objects
          SET category_id = NULL,
              updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE category_id = $1`,
      [id],
    )
  }
  const result = await execute('DELETE FROM household_categories WHERE id = $1', [id])
  if (result.rowsAffected === 0) {
    throw new Error('This category no longer exists.')
  }
}
