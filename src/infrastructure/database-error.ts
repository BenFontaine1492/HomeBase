import { describeError } from '@/utils/error'

/** Error type for every failure that originates from the database layer. */
export class DatabaseError extends Error {
  public readonly operation: string

  constructor(operation: string, cause: unknown) {
    super(`Database ${operation} failed: ${describeError(cause)}`, { cause })
    this.name = 'DatabaseError'
    this.operation = operation
  }
}
