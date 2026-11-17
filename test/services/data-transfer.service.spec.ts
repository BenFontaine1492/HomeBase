import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))
vi.mock('@/repositories/data-transfer.repository', () => ({
  createBackup: vi.fn(),
  inspectBackup: vi.fn(),
  restoreBackup: vi.fn(),
  exportJson: vi.fn(),
  exportCsv: vi.fn(),
  inspectExport: vi.fn(),
  importJson: vi.fn(),
}))

import { open, save } from '@tauri-apps/plugin-dialog'
import * as repository from '@/repositories/data-transfer.repository'
import * as service from '@/services/data-transfer.service'

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
  it('passes the native commands through from the repository', () => {
    expect(service.createBackup).toBe(repository.createBackup)
    expect(service.inspectBackup).toBe(repository.inspectBackup)
    expect(service.restoreBackup).toBe(repository.restoreBackup)
    expect(service.exportJson).toBe(repository.exportJson)
    expect(service.exportCsv).toBe(repository.exportCsv)
    expect(service.inspectExport).toBe(repository.inspectExport)
    expect(service.importJson).toBe(repository.importJson)
  })
})
