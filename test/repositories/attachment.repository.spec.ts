import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn() }))

import { execute, select } from '@/infrastructure/database'
import * as repository from '@/repositories/attachment.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import { AttachmentDetailsValues, AttachmentValues } from '@/types/attachment'

const details = AttachmentDetailsValues.from({ documentType: 'invoice', documentDate: '2025-10-01', notes: 'n' })
const file = { storedName: 'ff-0.pdf', originalName: 'invoice.pdf', sizeBytes: 12 }

describe('findAll', () => {
  it('maps rows to documents with their owner', async () => {
    const row = {
      id: 1,
      owner_kind: 'maintenance-record',
      owner_id: 4,
      stored_name: 'ff-0.pdf',
      original_name: 'invoice.pdf',
      mime_type: 'application/pdf',
      size_bytes: 12,
      document_type: 'invoice',
      document_date: null,
      notes: null,
      created_at: 'c',
      updated_at: 'u',
    }
    vi.mocked(select).mockResolvedValue([row])
    await expect(repository.findAll()).resolves.toEqual([
      {
        id: 1,
        owner: { kind: 'maintenance-record', id: 4 },
        storedName: 'ff-0.pdf',
        originalName: 'invoice.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12,
        documentType: 'invoice',
        documentDate: null,
        notes: null,
        createdAt: 'c',
        updatedAt: 'u',
      },
    ])
    expect(vi.mocked(select).mock.calls[0]?.[0]).toContain('AS owner_kind')
  })
})

describe('insert', () => {
  it.each([
    ['object', 'household_object_id'],
    ['maintenance-record', 'maintenance_record_id'],
  ] as const)('stores the %s owner in %s and returns the new id', async (kind, column) => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 9 })
    await expect(repository.insert(AttachmentValues.from({ kind, id: 7 }, details, file))).resolves.toBe(9)
    const [sql, params] = vi.mocked(execute).mock.calls[0] ?? []
    expect(sql).toContain(`INSERT INTO attachments (${column}, stored_name`)
    expect(params).toEqual([7, 'ff-0.pdf', 'invoice.pdf', 'application/pdf', 12, 'invoice', '2025-10-01', 'n'])
  })

  it('reports a missing owner as MissingReferenceError', async () => {
    vi.mocked(execute).mockRejectedValue(new Error('FOREIGN KEY constraint failed'))
    const values = AttachmentValues.from({ kind: 'object', id: 7 }, details, file)
    await expect(repository.insert(values)).rejects.toBeInstanceOf(MissingReferenceError)
  })
})

describe('update / remove', () => {
  it('updates the details and reports whether the document exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.update(3, details)).resolves.toBe(true)
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual(['invoice', '2025-10-01', 'n', 3])
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(repository.update(3, details)).resolves.toBe(false)
  })

  it('deletes a row and reports whether it existed', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.remove(3)).resolves.toBe(true)
    expect(execute).toHaveBeenCalledWith('DELETE FROM attachments WHERE id = $1', [3])
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(repository.remove(3)).resolves.toBe(false)
  })
})
