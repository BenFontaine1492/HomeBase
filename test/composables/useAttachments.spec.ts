import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Attachment, AttachmentOwner } from '@/types/attachment'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({
  pickAttachmentFile: vi.fn(),
  listAttachments: vi.fn(),
  addAttachment: vi.fn(),
  updateAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  openAttachment: vi.fn(),
}))
vi.mock('@/services/attachment.service', () => service)

function attachment(id: number, owner: AttachmentOwner): Attachment {
  return {
    id,
    owner,
    storedName: `${id}.pdf`,
    originalName: 'a.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1,
    documentType: 'other',
    documentDate: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
  }
}

const object7: AttachmentOwner = { kind: 'object', id: 7 }
const record7: AttachmentOwner = { kind: 'maintenance-record', id: 7 }

/** Fresh module-level state for every test. */
async function load() {
  vi.resetModules()
  const { useAttachments } = await import('@/composables/useAttachments')
  return useAttachments()
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useAttachments', () => {
  it('loads once and filters by owner', async () => {
    vi.mocked(service.listAttachments).mockResolvedValue([
      attachment(1, object7),
      attachment(2, record7),
      attachment(3, object7),
    ])
    const state = await load()

    await state.ensureLoaded()
    await state.ensureLoaded()

    expect(service.listAttachments).toHaveBeenCalledTimes(1)
    expect(state.attachmentsOf(object7).map((a) => a.id)).toEqual([1, 3])
    expect(state.attachmentsOf(record7).map((a) => a.id)).toEqual([2])
    expect(state.attachments.value).toHaveLength(3)
  })

  it('does not start a second load while one is running', async () => {
    vi.mocked(service.listAttachments).mockResolvedValue([])
    const state = await load()
    const first = state.refresh()
    await state.ensureLoaded()
    await first
    expect(service.listAttachments).toHaveBeenCalledTimes(1)
  })

  it('keeps the error message when loading fails', async () => {
    vi.mocked(service.listAttachments).mockRejectedValue(new Error('locked'))
    const state = await load()
    await state.refresh()
    expect(state.error.value).toBe('locked')
    expect(state.isLoading.value).toBe(false)
  })

  it('reloads after every write and passes picking and opening through', async () => {
    vi.mocked(service.listAttachments).mockResolvedValue([])
    vi.mocked(service.pickAttachmentFile).mockResolvedValue('C:/a.pdf')
    const state = await load()

    await expect(state.pickFile()).resolves.toBe('C:/a.pdf')
    await state.addAttachment(object7, 'C:/a.pdf', { documentType: 'invoice' })
    await state.updateAttachment(1, { documentType: 'manual' })
    await state.deleteAttachment(1)
    await state.openAttachment(1)

    expect(service.addAttachment).toHaveBeenCalledWith(object7, 'C:/a.pdf', { documentType: 'invoice' })
    expect(service.updateAttachment).toHaveBeenCalledWith(1, { documentType: 'manual' })
    expect(service.deleteAttachment).toHaveBeenCalledWith(1)
    expect(service.openAttachment).toHaveBeenCalledWith(1)
    expect(service.listAttachments).toHaveBeenCalledTimes(3)
  })
})
