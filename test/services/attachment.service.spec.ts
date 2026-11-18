import { describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@/repositories/attachment-file.repository', () => ({ storeAttachmentFile: vi.fn(), openAttachment: vi.fn() }))
vi.mock('@/repositories/attachment.repository', () => ({
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

import { open } from '@tauri-apps/plugin-dialog'
import * as fileRepository from '@/repositories/attachment-file.repository'
import * as repository from '@/repositories/attachment.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import {
  addAttachment,
  deleteAttachment,
  listAttachments,
  openAttachment,
  pickAttachmentFile,
  updateAttachment,
} from '@/services/attachment.service'
import { AttachmentValues } from '@/types/attachment'

const stored = { storedName: 'ff-0.jpg', originalName: 'front.jpg', sizeBytes: 3 }
const missing = new MissingReferenceError('FOREIGN KEY constraint failed')

describe('pickAttachmentFile', () => {
  it('returns the picked path, or null when cancelled', async () => {
    vi.mocked(open).mockResolvedValueOnce('C:/front.jpg')
    await expect(pickAttachmentFile()).resolves.toBe('C:/front.jpg')
    vi.mocked(open).mockResolvedValueOnce(null)
    await expect(pickAttachmentFile()).resolves.toBeNull()
  })
})

describe('listAttachments / openAttachment', () => {
  it('pass through to the repositories', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([])
    await expect(listAttachments()).resolves.toEqual([])
    vi.mocked(fileRepository.openAttachment).mockResolvedValue()
    await openAttachment(4)
    expect(fileRepository.openAttachment).toHaveBeenCalledWith(4)
  })
})

describe('addAttachment', () => {
  it('copies the file, then stores its row', async () => {
    vi.mocked(fileRepository.storeAttachmentFile).mockResolvedValue(stored)
    vi.mocked(repository.insert).mockResolvedValue(9)

    await expect(addAttachment({ kind: 'object', id: 7 }, 'C:/front.jpg', { documentType: 'photo' })).resolves.toBe(9)

    expect(fileRepository.storeAttachmentFile).toHaveBeenCalledWith('C:/front.jpg')
    const values = vi.mocked(repository.insert).mock.calls[0]?.[0]
    expect(values).toBeInstanceOf(AttachmentValues)
    expect(values).toMatchObject({ owner: { kind: 'object', id: 7 }, mimeType: 'image/jpeg', storedName: 'ff-0.jpg' })
  })

  it('checks the details before copying anything', async () => {
    await expect(
      addAttachment({ kind: 'object', id: 7 }, 'C:/front.jpg', { documentType: 'photo', documentDate: 'yesterday' }),
    ).rejects.toThrow('The document date is not a valid date.')
    expect(fileRepository.storeAttachmentFile).not.toHaveBeenCalled()
  })

  it.each([
    ['object', 'This object no longer exists.'],
    ['maintenance-record', 'This maintenance entry no longer exists.'],
  ] as const)('reports a deleted %s owner', async (kind, message) => {
    vi.mocked(fileRepository.storeAttachmentFile).mockResolvedValue(stored)
    vi.mocked(repository.insert).mockRejectedValue(missing)
    await expect(addAttachment({ kind, id: 7 }, 'C:/front.jpg', { documentType: 'receipt' })).rejects.toThrow(message)
  })
})

describe('updateAttachment / deleteAttachment', () => {
  it('update the details, or report a deleted document', async () => {
    vi.mocked(repository.update).mockResolvedValue(true)
    await updateAttachment(3, { documentType: 'manual', notes: ' n ' })
    expect(vi.mocked(repository.update).mock.calls[0]).toEqual([
      3,
      expect.objectContaining({ documentType: 'manual', notes: 'n' }),
    ])
    vi.mocked(repository.update).mockResolvedValue(false)
    await expect(updateAttachment(3, { documentType: 'manual' })).rejects.toThrow('This document no longer exists.')
  })

  it('delete a document, or report a deleted one', async () => {
    vi.mocked(repository.remove).mockResolvedValue(true)
    await deleteAttachment(3)
    vi.mocked(repository.remove).mockResolvedValue(false)
    await expect(deleteAttachment(3)).rejects.toThrow('This document no longer exists.')
  })
})
