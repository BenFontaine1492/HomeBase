import { describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@/infrastructure/log', () => ({ logError: vi.fn() }))

import { invoke } from '@tauri-apps/api/core'
import { logError } from '@/infrastructure/log'
import * as repository from '@/repositories/data-transfer.repository'

describe('commands', () => {
  it.each([
    ['createBackup', () => repository.createBackup('d'), 'create_backup', { destination: 'd' }],
    ['inspectBackup', () => repository.inspectBackup('s'), 'inspect_backup', { source: 's' }],
    ['restoreBackup', () => repository.restoreBackup('s'), 'restore_backup', { source: 's' }],
    ['exportJson', () => repository.exportJson('d'), 'export_json', { destination: 'd' }],
    ['exportCsv', () => repository.exportCsv('dir'), 'export_csv', { directory: 'dir' }],
    ['inspectExport', () => repository.inspectExport('s'), 'inspect_export', { source: 's' }],
    ['importJson', () => repository.importJson('s'), 'import_json', { source: 's' }],
  ] as const)('%s invokes %s and returns its result', async (_, run, command, args) => {
    vi.mocked(invoke).mockResolvedValue('result')
    await expect(run()).resolves.toBe('result')
    expect(invoke).toHaveBeenCalledWith(command, args)
  })

  it('turns a rejected command into a logged Error', async () => {
    vi.mocked(invoke).mockRejectedValue('The backup is damaged: page 3')
    const error = await repository.inspectBackup('s').catch((thrown: unknown) => thrown)
    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({ message: 'The backup is damaged: page 3', cause: 'The backup is damaged: page 3' })
    expect(logError).toHaveBeenCalledWith('Command inspect_backup failed: The backup is damaged: page 3')
  })
})
