import { describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@/infrastructure/log', () => ({ logError: vi.fn() }))

import { invoke } from '@tauri-apps/api/core'
import { logError } from '@/infrastructure/log'
import { callCommand } from '@/repositories/native-command'

describe('callCommand', () => {
  it('returns the result of the command', async () => {
    vi.mocked(invoke).mockResolvedValue(42)
    await expect(callCommand('answer', { a: 1 })).resolves.toBe(42)
    expect(invoke).toHaveBeenCalledWith('answer', { a: 1 })
  })

  it('turns a rejected command into a logged Error', async () => {
    vi.mocked(invoke).mockRejectedValue('The file of this document is missing.')
    const error = await callCommand('open_attachment', { id: 1 }).catch((thrown: unknown) => thrown)
    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({ message: 'The file of this document is missing.' })
    expect(logError).toHaveBeenCalledWith('Command open_attachment failed: The file of this document is missing.')
  })
})
