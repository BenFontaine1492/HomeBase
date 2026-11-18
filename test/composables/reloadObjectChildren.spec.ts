import { describe, expect, it, vi } from 'vitest'

const refresh = vi.hoisted(() => ({ maintenance: vi.fn(), attachments: vi.fn() }))
vi.mock('@/composables/useMaintenance', () => ({ useMaintenance: () => ({ refresh: refresh.maintenance }) }))
vi.mock('@/composables/useAttachments', () => ({ useAttachments: () => ({ refresh: refresh.attachments }) }))

import { reloadObjectChildren } from '@/composables/reloadObjectChildren'

describe('reloadObjectChildren', () => {
  it('reloads every list of object child rows', async () => {
    await reloadObjectChildren()
    expect(refresh.maintenance).toHaveBeenCalledTimes(1)
    expect(refresh.attachments).toHaveBeenCalledTimes(1)
  })
})
