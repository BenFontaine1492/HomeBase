import type { QueryResult } from '@/infrastructure/database'
import { describeError } from '@/utils/error'

/*
 * Typed errors for database failures that services turn into user messages.
 * Repositories never phrase messages for the user; "row not found" is reported
 * as a `false` result, not as an error.
 */

/** A write refers to a row that doesn't exist (SQLite FOREIGN KEY constraint). */
export class MissingReferenceError extends Error {
  constructor(cause: unknown) {
    super(describeError(cause), { cause })
    this.name = 'MissingReferenceError'
  }
}

/** A write would store a value twice that must be unique (SQLite UNIQUE constraint). */
export class DuplicateValueError extends Error {
  constructor(cause: unknown) {
    super(describeError(cause), { cause })
    this.name = 'DuplicateValueError'
  }
}

/** Rethrows SQLite constraint failures as the typed errors above, anything else unchanged. */
export function rethrowConstraintError(error: unknown): never {
  const message = describeError(error)
  if (message.includes('FOREIGN KEY constraint failed')) throw new MissingReferenceError(error)
  if (message.includes('UNIQUE constraint failed')) throw new DuplicateValueError(error)
  throw error
}

/** The id of a row just inserted. `entity` names it in the error, e.g. 'object'. */
export function insertedId(result: QueryResult | undefined, entity: string): number {
  if (result?.lastInsertId === undefined) {
    throw new Error(`The database did not return an id for the new ${entity}.`)
  }
  return result.lastInsertId
}
