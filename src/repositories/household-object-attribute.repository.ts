import { select, type SqlStatement } from '@/infrastructure/database'
import type {
  AttributeValueType,
  HouseholdObjectAttribute,
  HouseholdObjectAttributeValues,
} from '@/types/household-object-attribute'

/*
 * Attributes belong to their object: they are written only together with it,
 * as part of the object's transaction (see household-object.repository.ts),
 * which replaces the object's whole attribute list.
 */

interface HouseholdObjectAttributeRow {
  id: number
  household_object_id: number
  name: string
  value_type: AttributeValueType
  value: string | null
  unit: string | null
  sort_order: number
}

function mapRow(row: HouseholdObjectAttributeRow): HouseholdObjectAttribute {
  return {
    id: row.id,
    objectId: row.household_object_id,
    name: row.name,
    valueType: row.value_type,
    value: row.value,
    unit: row.unit,
    sortOrder: row.sort_order,
  }
}

/** All attributes of all objects, in display order per object. */
export async function findAll(): Promise<HouseholdObjectAttribute[]> {
  const rows = await select<HouseholdObjectAttributeRow>(
    `SELECT id, household_object_id, name, value_type, value, unit, sort_order
       FROM household_object_attributes
      ORDER BY household_object_id ASC, sort_order ASC, id ASC`,
  )
  return rows.map(mapRow)
}

/**
 * SQL for the object inserted earlier in the same transaction: ids use
 * AUTOINCREMENT and only ever grow, so the newest object has the highest id.
 */
const NEW_OBJECT_ID = '(SELECT max(id) FROM household_objects)'

/**
 * Statements that replace all attributes of an object, for a transaction.
 * `'new'` = the object inserted by an earlier statement of the same transaction.
 * The list order becomes the display order.
 */
export function replaceStatements(
  objectId: number | 'new',
  attributes: readonly HouseholdObjectAttributeValues[],
): SqlStatement[] {
  const objectRef = objectId === 'new' ? NEW_OBJECT_ID : '$6'
  const idParam = objectId === 'new' ? [] : [objectId]
  const inserts = attributes.map((attribute, index): SqlStatement => ({
    sql: `INSERT INTO household_object_attributes
              (household_object_id, name, value_type, value, unit, sort_order)
            VALUES (${objectRef}, $1, $2, $3, $4, $5)`,
    params: [attribute.name, attribute.valueType, attribute.value, attribute.unit, index, ...idParam],
  }))
  if (objectId === 'new') return inserts
  return [
    { sql: 'DELETE FROM household_object_attributes WHERE household_object_id = $1', params: [objectId] },
    ...inserts,
  ]
}
