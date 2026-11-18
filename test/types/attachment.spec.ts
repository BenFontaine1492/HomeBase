import { describe, expect, it } from 'vitest'
import {
  AttachmentDetailsValues,
  AttachmentValues,
  guessDocumentType,
  isSameOwner,
  mimeTypeFor,
  type DocumentType,
  type StoredAttachmentFile,
} from '@/types/attachment'

const file: StoredAttachmentFile = { storedName: 'ff-0.pdf', originalName: ' invoice.PDF ', sizeBytes: 1200 }
const details = AttachmentDetailsValues.from({ documentType: 'invoice' })

describe('AttachmentDetailsValues.from', () => {
  it('can only be created through from() (checked by the type check)', () => {
    // @ts-expect-error a plain object is not an AttachmentDetailsValues
    const lookalike: AttachmentDetailsValues = { documentType: 'other', documentDate: null, notes: null }
    expect(lookalike).not.toBeInstanceOf(AttachmentDetailsValues)
  })

  it('trims the input and turns empty text into null', () => {
    expect({
      ...AttachmentDetailsValues.from({ documentType: 'manual', documentDate: ' 2025-10-01 ', notes: ' ' }),
    }).toEqual({ documentType: 'manual', documentDate: '2025-10-01', notes: null })
    expect({ ...AttachmentDetailsValues.from({ documentType: 'photo', notes: ' Front ' }) }).toEqual({
      documentType: 'photo',
      documentDate: null,
      notes: 'Front',
    })
  })

  it('rejects unknown types and invalid dates', () => {
    expect(() => AttachmentDetailsValues.from({ documentType: 'letter' as DocumentType })).toThrow(
      'Unknown document type.',
    )
    expect(() => AttachmentDetailsValues.from({ documentType: 'invoice', documentDate: '01.10.2025' })).toThrow(
      'The document date is not a valid date.',
    )
  })
})

describe('AttachmentValues.from', () => {
  it('combines owner, details and file, with the media type from the file name', () => {
    const values = AttachmentValues.from({ kind: 'object', id: 7 }, details, file)
    expect({ ...values }).toEqual({
      owner: { kind: 'object', id: 7 },
      details,
      storedName: 'ff-0.pdf',
      originalName: 'invoice.PDF',
      mimeType: 'application/pdf',
      sizeBytes: 1200,
    })
  })

  it.each([0, -1, 1.5])('rejects the owner id %d', (id) => {
    expect(() => AttachmentValues.from({ kind: 'maintenance-record', id }, details, file)).toThrow(
      'Invalid owner of the document.',
    )
  })

  it('rejects files without a name or with an invalid size', () => {
    const owner = { kind: 'object', id: 1 } as const
    expect(() => AttachmentValues.from(owner, details, { ...file, storedName: '' })).toThrow('The file has no name.')
    expect(() => AttachmentValues.from(owner, details, { ...file, originalName: ' ' })).toThrow('The file has no name.')
    expect(() => AttachmentValues.from(owner, details, { ...file, sizeBytes: -1 })).toThrow('Invalid file size.')
    expect(() => AttachmentValues.from(owner, details, { ...file, sizeBytes: 0.5 })).toThrow('Invalid file size.')
  })
})

describe('isSameOwner', () => {
  it('compares kind and id', () => {
    expect(isSameOwner({ kind: 'object', id: 1 }, { kind: 'object', id: 1 })).toBe(true)
    expect(isSameOwner({ kind: 'object', id: 1 }, { kind: 'object', id: 2 })).toBe(false)
    expect(isSameOwner({ kind: 'object', id: 1 }, { kind: 'maintenance-record', id: 1 })).toBe(false)
  })
})

describe('mimeTypeFor / guessDocumentType', () => {
  it.each([
    ['manual.pdf', 'application/pdf', 'other'],
    ['IMG_0001.JPG', 'image/jpeg', 'photo'],
    ['scan.heic', 'image/heic', 'photo'],
    ['notes', 'application/octet-stream', 'other'],
    ['archive.xyz', 'application/octet-stream', 'other'],
  ])('%s → %s, %s', (name, mimeType, documentType) => {
    expect(mimeTypeFor(name)).toBe(mimeType)
    expect(guessDocumentType(name)).toBe(documentType)
  })
})
