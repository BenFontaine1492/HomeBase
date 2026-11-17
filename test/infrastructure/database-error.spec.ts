import { describe, expect, it } from 'vitest'
import { DatabaseError } from '@/infrastructure/database-error'

describe('DatabaseError', () => {
  it('describes the operation and keeps the cause', () => {
    const cause = 'disk I/O error'
    const error = new DatabaseError('select', cause)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('DatabaseError')
    expect(error.operation).toBe('select')
    expect(error.message).toBe('Database select failed: disk I/O error')
    expect(error.cause).toBe(cause)
  })
})
