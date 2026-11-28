import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackupInfo, ExportInfo } from '@/types/data-transfer'

vi.mock('@/services/data-transfer.service', () => ({
  pickBackupDestination: vi.fn(),
  pickBackupSource: vi.fn(),
  pickJsonExportDestination: vi.fn(),
  pickCsvExportFolder: vi.fn(),
  pickJsonImportSource: vi.fn(),
  createBackup: vi.fn(),
  inspectBackup: vi.fn(),
  restoreBackup: vi.fn(),
  exportJson: vi.fn(),
  exportCsv: vi.fn(),
  inspectExport: vi.fn(),
  importJson: vi.fn(),
}))

const refresh = vi.hoisted(() => ({
  projects: vi.fn(),
  investments: vi.fn(),
  categories: vi.fn(),
  objects: vi.fn(),
  children: vi.fn(),
  settings: vi.fn(),
  dashboard: vi.fn(),
}))
vi.mock('@/composables/useProjects', () => ({ useProjects: () => ({ refresh: refresh.projects }) }))
vi.mock('@/composables/useInvestments', () => ({ useInvestments: () => ({ refresh: refresh.investments }) }))
vi.mock('@/composables/useHouseholdCategories', () => ({
  useHouseholdCategories: () => ({ refresh: refresh.categories }),
}))
vi.mock('@/composables/useHouseholdObjects', () => ({ useHouseholdObjects: () => ({ refresh: refresh.objects }) }))
vi.mock('@/composables/reloadObjectChildren', () => ({ reloadObjectChildren: refresh.children }))
vi.mock('@/composables/useSettings', () => ({ useSettings: () => ({ refresh: refresh.settings }) }))
vi.mock('@/composables/useDashboard', () => ({ useDashboard: () => ({ refresh: refresh.dashboard }) }))

import * as service from '@/services/data-transfer.service'
import { useDataTransfer } from '@/composables/useDataTransfer'

const backup: BackupInfo = { path: 'C:/backup.db', schemaVersion: 2, appSchemaVersion: 2, tables: [] }
const exported: ExportInfo = { ...backup, path: 'C:/export.json', exportedAt: '2026-01-01T00:00:00Z' }

const transfer = useDataTransfer()

function expectAllListsReloaded(): void {
  expect(refresh.projects).toHaveBeenCalledTimes(1)
  expect(refresh.investments).toHaveBeenCalledTimes(1)
  expect(refresh.categories).toHaveBeenCalledTimes(1)
  expect(refresh.objects).toHaveBeenCalledTimes(1)
  expect(refresh.children).toHaveBeenCalledTimes(1)
  expect(refresh.settings).toHaveBeenCalledTimes(1)
  expect(refresh.dashboard).toHaveBeenCalledTimes(1)
}

beforeEach(() => {
  for (const reload of Object.values(refresh)) reload.mockResolvedValue(undefined)
})

describe('file dialogs', () => {
  it('returns null and does nothing when the user cancels', async () => {
    vi.mocked(service.pickBackupDestination).mockResolvedValue(null)
    vi.mocked(service.pickBackupSource).mockResolvedValue(null)
    vi.mocked(service.pickJsonExportDestination).mockResolvedValue(null)
    vi.mocked(service.pickCsvExportFolder).mockResolvedValue(null)
    vi.mocked(service.pickJsonImportSource).mockResolvedValue(null)

    await expect(transfer.createBackup()).resolves.toBeNull()
    await expect(transfer.chooseBackup()).resolves.toBeNull()
    await expect(transfer.exportJson()).resolves.toBeNull()
    await expect(transfer.exportCsv()).resolves.toBeNull()
    await expect(transfer.chooseExport()).resolves.toBeNull()

    for (const command of [
      service.createBackup,
      service.inspectBackup,
      service.exportJson,
      service.exportCsv,
      service.inspectExport,
    ]) {
      expect(command).not.toHaveBeenCalled()
    }
  })

  it('runs the command with the picked path', async () => {
    vi.mocked(service.pickBackupDestination).mockResolvedValue('C:/b.db')
    vi.mocked(service.pickBackupSource).mockResolvedValue('C:/backup.db')
    vi.mocked(service.inspectBackup).mockResolvedValue(backup)
    vi.mocked(service.pickJsonExportDestination).mockResolvedValue('C:/e.json')
    vi.mocked(service.pickCsvExportFolder).mockResolvedValue('C:/out')
    vi.mocked(service.exportCsv).mockResolvedValue('C:/out/homebase-export-x')
    vi.mocked(service.pickJsonImportSource).mockResolvedValue('C:/export.json')
    vi.mocked(service.inspectExport).mockResolvedValue(exported)

    await expect(transfer.createBackup()).resolves.toBe('C:/b.db')
    await expect(transfer.chooseBackup()).resolves.toBe(backup)
    await expect(transfer.exportJson()).resolves.toBe('C:/e.json')
    await expect(transfer.exportCsv()).resolves.toBe('C:/out/homebase-export-x')
    await expect(transfer.chooseExport()).resolves.toBe(exported)

    expect(service.createBackup).toHaveBeenCalledWith('C:/b.db')
    expect(service.inspectBackup).toHaveBeenCalledWith('C:/backup.db')
    expect(service.exportJson).toHaveBeenCalledWith('C:/e.json')
    expect(service.exportCsv).toHaveBeenCalledWith('C:/out')
    expect(service.inspectExport).toHaveBeenCalledWith('C:/export.json')
  })
})

describe('restore and import', () => {
  it('restores the backup and reloads every list', async () => {
    await transfer.restoreBackup(backup)
    expect(service.restoreBackup).toHaveBeenCalledWith('C:/backup.db')
    expectAllListsReloaded()
  })

  it('reloads every list even when the restore fails, then rethrows', async () => {
    vi.mocked(service.restoreBackup).mockRejectedValue(new Error('rolled back'))
    await expect(transfer.restoreBackup(backup)).rejects.toThrow('rolled back')
    expectAllListsReloaded()
  })

  it('imports the export and reloads every list', async () => {
    await transfer.importExport(exported)
    expect(service.importJson).toHaveBeenCalledWith('C:/export.json')
    expectAllListsReloaded()
  })

  it('reloads every list even when the import fails, then rethrows', async () => {
    vi.mocked(service.importJson).mockRejectedValue(new Error('inconsistent'))
    await expect(transfer.importExport(exported)).rejects.toThrow('inconsistent')
    expectAllListsReloaded()
  })
})
