import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/household-object-attribute.repository', () => ({ findAll: vi.fn() }))

import * as repository from '@/repositories/household-object-attribute.repository'
import { listAttributes } from '@/services/household-object-attribute.service'

describe('listAttributes', () => {
  it('returns the attributes from the repository', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([])
    await expect(listAttributes()).resolves.toEqual([])
  })
})
