import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/native-command', () => ({ callCommand: vi.fn() }))

import * as files from '@/repositories/attachment-file.repository'
import { callCommand } from '@/repositories/native-command'

describe('attachment file commands', () => {
  it.each([
    [
      'storeAttachmentFile',
      () => files.storeAttachmentFile('C:/a.pdf'),
      'store_attachment_file',
      { source: 'C:/a.pdf' },
    ],
    ['openAttachment', () => files.openAttachment(3), 'open_attachment', { id: 3 }],
  ] as const)('%s calls %s', async (_, run, command, args) => {
    vi.mocked(callCommand).mockResolvedValue('result')
    await expect(run()).resolves.toBe('result')
    expect(callCommand).toHaveBeenCalledWith(command, args)
  })
})
