import { describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({ error: vi.fn() }))

import { error } from '@tauri-apps/plugin-log'
import { logError } from '@/infrastructure/log'

describe('logError', () => {
  it('writes the message as is without a cause', () => {
    vi.mocked(error).mockResolvedValue(undefined)
    logError('Something failed')
    expect(error).toHaveBeenCalledWith('Something failed')
  })

  it('appends a description of the cause', () => {
    vi.mocked(error).mockResolvedValue(undefined)
    logError('Something failed', new Error('boom'))
    expect(error).toHaveBeenCalledWith('Something failed: boom')
  })

  it('never throws when the log plugin rejects', async () => {
    vi.mocked(error).mockRejectedValue(new Error('no Tauri runtime'))
    expect(() => logError('Something failed')).not.toThrow()
    // Let the swallowed rejection settle (an unhandled rejection would fail the run).
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
