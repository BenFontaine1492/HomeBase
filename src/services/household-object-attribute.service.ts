import * as attributeRepository from '@/repositories/household-object-attribute.repository'
import type { HouseholdObjectAttribute } from '@/types/household-object-attribute'

/*
 * Attributes are validated by `HouseholdObjectAttributeValues` and saved together
 * with their object (see household-object.service.ts), so this module only lists them.
 */

/** All attributes of all objects, in display order per object. */
export function listAttributes(): Promise<HouseholdObjectAttribute[]> {
  return attributeRepository.findAll()
}
