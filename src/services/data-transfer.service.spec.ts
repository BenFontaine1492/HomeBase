import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))
vi.mock('./log.service', () => ({ logError: vi.fn() }))

import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { logError } from './log.service'
import * as service from './data-transfer.service'

beforeEach(() => {
  vi.useFakeTimers()
  // Month and day below 10, to check the zero padding of the suggested file names.
  vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('save dialogs', () => {
  it('suggests a dated backup file name', async () => {
    vi.mocked(save).mockResolvedValue('C:/b.db')
    await expect(service.pickBackupDestination()).resolves.toBe('C:/b.db')
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: 'homebase-backup-2026-01-05.db' }))
  })

  it('suggests a dated export file name', async () => {
    vi.mocked(save).mockResolvedValue(null)
    await expect(service.pickJsonExportDestination()).resolves.toBeNull()
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: 'homebase-export-2026-01-05.json' }))
  })

  it('pads two-digit months and days too', async () => {
    vi.setSystemTime(new Date(2026, 10, 15))
    vi.mocked(save).mockResolvedValue(null)
    await service.pickBackupDestination()
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: 'homebase-backup-2026-11-15.db' }))
  })
})

describe('open dialogs', () => {
  it.each([
    ['pickBackupSource', service.pickBackupSource, false],
    ['pickCsvExportFolder', service.pickCsvExportFolder, true],
    ['pickJsonImportSource', service.pickJsonImportSource, false],
  ] as const)('%s returns the picked path, or null otherwise', async (_, pick, directory) => {
    vi.mocked(open).mockResolvedValueOnce('C:/picked')
    await expect(pick()).resolves.toBe('C:/picked')
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ multiple: false, directory }))

    vi.mocked(open).mockResolvedValueOnce(null)
    await expect(pick()).resolves.toBeNull()
  })
})

describe('commands', () => {
  it.each([
    ['createBackup', () => service.createBackup('d'), 'create_backup', { destination: 'd' }],
    ['inspectBackup', () => service.inspectBackup('s'), 'inspect_backup', { source: 's' }],
    ['restoreBackup', () => service.restoreBackup('s'), 'restore_backup', { source: 's' }],
    ['exportJson', () => service.exportJson('d'), 'export_json', { destination: 'd' }],
    ['exportCsv', () => service.exportCsv('dir'), 'export_csv', { directory: 'dir' }],
    ['inspectExport', () => service.inspectExport('s'), 'inspect_export', { source: 's' }],
    ['importJson', () => service.importJson('s'), 'import_json', { source: 's' }],
  ] as const)('%s invokes %s and returns its result', async (_, run, command, args) => {
    vi.mocked(invoke).mockResolvedValue('result')
    await expect(run()).resolves.toBe('result')
    expect(invoke).toHaveBeenCalledWith(command, args)
  })

  it('turns a rejected command into a logged Error', async () => {
    vi.mocked(invoke).mockRejectedValue('The backup is damaged: page 3')
    await expect(service.inspectBackup('s')).rejects.toThrow(new Error('The backup is damaged: page 3'))
    expect(logError).toHaveBeenCalledWith('Command inspect_backup failed: The backup is damaged: page 3')
  })
})
