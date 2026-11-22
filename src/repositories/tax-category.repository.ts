import { execute, select, transaction } from '@/infrastructure/database'
import { insertedId, rethrowConstraintError } from './repository-errors'
import type { TaxCategory, TaxCategoryValues } from '@/types/tax-category'

interface TaxCategoryRow {
  id: number
  name: string
  records_labour_cost: number
  sort_order: number
  created_at: string
  updated_at: string
}

function mapRow(row: TaxCategoryRow): TaxCategory {
  return {
    id: row.id,
    name: row.name,
    recordsLabourCost: row.records_labour_cost === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** A new category goes to the end of the list. */
const INSERT_SQL = `INSERT INTO tax_categories (name, records_labour_cost, sort_order)
     VALUES ($1, $2, (SELECT coalesce(max(sort_order), -1) + 1 FROM tax_categories))`

/** All tax categories, in list order. */
export async function findAll(): Promise<TaxCategory[]> {
  const rows = await select<TaxCategoryRow>(
    `SELECT id, name, records_labour_cost, sort_order, created_at, updated_at
       FROM tax_categories
      ORDER BY sort_order ASC, name COLLATE NOCASE ASC, id ASC`,
  )
  return rows.map(mapRow)
}

/** Inserts a category at the end and returns its id. A name in use throws `DuplicateValueError`. */
export async function insert(values: TaxCategoryValues): Promise<number> {
  const result = await execute(INSERT_SQL, [values.name, values.recordsLabourCost ? 1 : 0]).catch(
    rethrowConstraintError,
  )
  return insertedId(result, 'tax category')
}

/**
 * Adds several categories in one transaction, in this order. Names already in
 * the list are skipped.
 */
export async function insertAll(list: readonly TaxCategoryValues[]): Promise<void> {
  await transaction(
    list.map((values) => ({
      sql: `${INSERT_SQL} ON CONFLICT (name) DO NOTHING`,
      params: [values.name, values.recordsLabourCost ? 1 : 0],
    })),
  )
}

/** false = no such category. A name in use throws `DuplicateValueError`. */
export async function update(id: number, values: TaxCategoryValues): Promise<boolean> {
  const result = await execute(
    `UPDATE tax_categories
        SET name = $1,
            records_labour_cost = $2,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $3`,
    [values.name, values.recordsLabourCost ? 1 : 0, id],
  ).catch(rethrowConstraintError)
  return result.rowsAffected > 0
}

/** Deletes a category; its costs keep their data, without a category (ON DELETE SET NULL). */
export async function remove(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM tax_categories WHERE id = $1', [id])
  return result.rowsAffected > 0
}
