import * as objectRepository from '@/repositories/household-object.repository'
import { HouseholdObjectValues, type HouseholdObject, type HouseholdObjectInput } from '@/types/household-object'
import type { HouseholdObjectAttributeInput } from '@/types/household-object-attribute'
import { rethrowWithMessage } from './service-errors'

/** Turns a missing reference (a row deleted meanwhile) into `message`. */
function rethrowMissingReference(message: string): (error: unknown) => never {
  return rethrowWithMessage({ missingReference: message })
}

export function listObjects(): Promise<HouseholdObject[]> {
  return objectRepository.findAll()
}

/** Creates an object with its attributes (all or nothing) and returns its id. */
export async function createObject(
  input: HouseholdObjectInput,
  attributes: readonly HouseholdObjectAttributeInput[],
): Promise<number> {
  return objectRepository
    .insert(HouseholdObjectValues.from(input, attributes))
    .catch(rethrowMissingReference('The selected category no longer exists.'))
}

/** Updates an object and replaces its attributes with `attributes` (all or nothing). */
export async function updateObject(
  id: number,
  input: HouseholdObjectInput,
  attributes: readonly HouseholdObjectAttributeInput[],
): Promise<void> {
  const found = await objectRepository
    .update(id, HouseholdObjectValues.from(input, attributes))
    .catch(rethrowMissingReference('This object or its category no longer exists.'))
  if (!found) throw new Error('This object no longer exists.')
}

/** Permanently deletes an object and its attributes. */
export async function deleteObject(id: number): Promise<void> {
  if (!(await objectRepository.remove(id))) {
    throw new Error('This object no longer exists.')
  }
}
