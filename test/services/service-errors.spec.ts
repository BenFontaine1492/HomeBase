import { describe, expect, it } from 'vitest'
import { DuplicateValueError, MissingReferenceError } from '@/repositories/repository-errors'
import { rethrowWithMessage } from '@/services/service-errors'

const missing = new MissingReferenceError('FOREIGN KEY constraint failed')
const duplicate = new DuplicateValueError('UNIQUE constraint failed')

describe('rethrowWithMessage', () => {
  it('replaces typed errors that have a message', () => {
    const rethrow = rethrowWithMessage({ missingReference: 'Gone.', duplicateValue: 'Taken.' })
    expect(() => rethrow(missing)).toThrow(new Error('Gone.'))
    expect(() => rethrow(duplicate)).toThrow(new Error('Taken.'))
  })

  it('rethrows everything else unchanged', () => {
    const rethrow = rethrowWithMessage({})
    const other = new Error('disk full')
    expect(() => rethrow(missing)).toThrow(missing)
    expect(() => rethrow(duplicate)).toThrow(duplicate)
    expect(() => rethrow(other)).toThrow(other)
  })
})
