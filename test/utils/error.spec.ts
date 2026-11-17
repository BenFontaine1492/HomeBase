import { describe, expect, it } from 'vitest'
import { describeError } from '@/utils/error'

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
