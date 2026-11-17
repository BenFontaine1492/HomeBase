import { describe, expect, it } from 'vitest'
import {
  DuplicateValueError,
  MissingReferenceError,
  insertedId,
  rethrowConstraintError,
} from '@/repositories/repository-errors'

describe('rethrowConstraintError', () => {
  it('turns a foreign key violation into MissingReferenceError', () => {
    const cause = new Error('FOREIGN KEY constraint failed')
    const error = (() => {
      try {
        rethrowConstraintError(cause)
      } catch (thrown) {
        return thrown
      }
    })()
    expect(error).toBeInstanceOf(MissingReferenceError)
    expect(error).toMatchObject({ name: 'MissingReferenceError', message: 'FOREIGN KEY constraint failed', cause })
  })

  it('turns a unique violation into DuplicateValueError', () => {
    expect(() => rethrowConstraintError('UNIQUE constraint failed: t.name')).toThrow(DuplicateValueError)
    expect(() => rethrowConstraintError('UNIQUE constraint failed: t.name')).toThrow(
      expect.objectContaining({ name: 'DuplicateValueError' }),
    )
  })

  it('rethrows other errors unchanged', () => {
    const failure = new Error('disk full')
    expect(() => rethrowConstraintError(failure)).toThrow(failure)
  })
})

describe('insertedId', () => {
  it('returns the id of the inserted row', () => {
    expect(insertedId({ rowsAffected: 1, lastInsertId: 4 }, 'object')).toBe(4)
  })

  it.each([undefined, { rowsAffected: 1 }])('fails without an id (%j)', (result) => {
    expect(() => insertedId(result, 'object')).toThrow('The database did not return an id for the new object.')
  })
})
