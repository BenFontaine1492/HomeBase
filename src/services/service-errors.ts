import { DuplicateValueError, MissingReferenceError } from '@/repositories/repository-errors'

/** User-facing messages for the typed repository errors a write can throw. */
export interface ConstraintMessages {
  /** A referenced row (e.g. the object) was deleted meanwhile. */
  missingReference?: string
  /** A value that must be unique is already used. */
  duplicateValue?: string
}

/**
 * For `.catch()`: rethrows a typed repository error as an `Error` with the given
 * message, anything else unchanged.
 */
export function rethrowWithMessage(messages: ConstraintMessages): (error: unknown) => never {
  return (error) => {
    if (error instanceof MissingReferenceError && messages.missingReference) throw new Error(messages.missingReference)
    if (error instanceof DuplicateValueError && messages.duplicateValue) throw new Error(messages.duplicateValue)
    throw error
  }
}
