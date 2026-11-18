import { describe, expect, it } from 'vitest'
import { formatFileSize } from '@/utils/file-size'

const number = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1536, `${number(1.5)} KB`],
    [3_400_000, `${number(3.2)} MB`],
    [1_200_000_000, `${number(1.1)} GB`],
    [5 * 1024 ** 4, `${number(5120)} GB`],
  ])('%i bytes → %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected)
  })
})
