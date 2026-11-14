/** Error type for every failure that originates from the database layer. */
export class DatabaseError extends Error {
  public readonly operation: string

  constructor(operation: string, cause: unknown) {
    super(`Database ${operation} failed: ${describeError(cause)}`, { cause })
    this.name = 'DatabaseError'
    this.operation = operation
  }
}

/** The SQL plugin rejects with plain strings; normalise anything into readable text. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}
