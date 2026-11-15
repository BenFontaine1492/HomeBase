import { describe, expect, it } from 'vitest'
import { DatabaseError, describeError } from '@/services/database/database-error'

describe('describeError', () => {
  it('uses the message of an Error', () => {
    expect(describeError(new Error('boom'))).toBe('boom')
  })

  it('returns strings unchanged', () => {
    expect(describeError('plain text')).toBe('plain text')
  })

  it('serialises other values as JSON', () => {
    expect(describeError({ code: 5 })).toBe('{"code":5}')
  })

  it('falls back to String() when JSON serialisation fails', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(describeError(circular)).toBe('[object Object]')
  })
})

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
