import { t } from '@/i18n'
import { isValidIsoDate } from '@/utils/date'
import { normaliseText } from '@/utils/text'

/** Kinds of document. Must match the CHECK in migration 0005. */
export const DOCUMENT_TYPES = ['invoice', 'receipt', 'contract', 'manual', 'warranty', 'photo', 'other'] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export function documentTypeLabel(type: DocumentType): string {
  return t(`documents.types.${type}`)
}

export const DOCUMENT_TYPE_ICONS: Readonly<Record<DocumentType, string>> = {
  invoice: 'mdi-receipt-text-outline',
  receipt: 'mdi-receipt-outline',
  contract: 'mdi-file-sign',
  manual: 'mdi-book-open-variant-outline',
  warranty: 'mdi-shield-check-outline',
  photo: 'mdi-image-outline',
  other: 'mdi-file-outline',
}

/**
 * What an attachment belongs to: exactly one owner (the database enforces it,
 * see migration 0005). A new owner (e.g. an expense) gets a new member here and
 * a column in `OWNER_COLUMNS` (attachment.repository.ts).
 */
export type AttachmentOwner = { kind: 'object'; id: number } | { kind: 'maintenance-record'; id: number }

export type AttachmentOwnerKind = AttachmentOwner['kind']

export function isSameOwner(a: AttachmentOwner, b: AttachmentOwner): boolean {
  return a.kind === b.kind && a.id === b.id
}

/** A document: its metadata. The file itself is `attachments/<storedName>` in the app data folder. */
export interface Attachment {
  id: number
  owner: AttachmentOwner
  /** Unique file name in `attachments/`, chosen natively. */
  storedName: string
  /** The name of the file the user picked, e.g. 'invoice-heatpump.pdf'. */
  originalName: string
  mimeType: string
  sizeBytes: number
  documentType: DocumentType
  /** 'YYYY-MM-DD', e.g. the invoice date. */
  documentDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** The fields the user edits, for adding and editing a document. */
export interface AttachmentDetailsInput {
  documentType: DocumentType
  documentDate?: string | null
  notes?: string | null
}

/** A file copied into `attachments/` (result of the native `store_attachment_file`). */
export interface StoredAttachmentFile {
  storedName: string
  originalName: string
  sizeBytes: number
}

/** The editable fields of a document, validated (value object). Only `from()` can create one. */
export class AttachmentDetailsValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'AttachmentDetailsValues'

  private constructor(
    readonly documentType: DocumentType,
    /** 'YYYY-MM-DD' */
    readonly documentDate: string | null,
    readonly notes: string | null,
  ) {}

  static from(input: AttachmentDetailsInput): AttachmentDetailsValues {
    if (!DOCUMENT_TYPES.includes(input.documentType)) throw new Error(t('errors.document.unknownType'))
    const documentDate = normaliseText(input.documentDate)
    if (documentDate !== null && !isValidIsoDate(documentDate)) {
      throw new Error(t('errors.document.invalidDate'))
    }
    return new AttachmentDetailsValues(input.documentType, documentDate, normaliseText(input.notes))
  }
}

/** A new document: owner, details and the stored file (value object). Only `from()` can create one. */
export class AttachmentValues {
  declare private readonly brand: 'AttachmentValues'

  readonly owner: AttachmentOwner
  readonly details: AttachmentDetailsValues
  readonly storedName: string
  readonly originalName: string
  readonly mimeType: string
  readonly sizeBytes: number

  private constructor(fields: Omit<AttachmentValues, 'brand'>) {
    this.owner = fields.owner
    this.details = fields.details
    this.storedName = fields.storedName
    this.originalName = fields.originalName
    this.mimeType = fields.mimeType
    this.sizeBytes = fields.sizeBytes
  }

  static from(owner: AttachmentOwner, details: AttachmentDetailsValues, file: StoredAttachmentFile): AttachmentValues {
    if (!Number.isSafeInteger(owner.id) || owner.id <= 0) throw new Error(t('errors.document.invalidOwner'))
    const originalName = file.originalName.trim()
    if (file.storedName.length === 0 || originalName.length === 0) throw new Error(t('errors.document.noFileName'))
    if (!Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 0) throw new Error(t('errors.document.invalidSize'))
    return new AttachmentValues({
      owner,
      details,
      storedName: file.storedName,
      originalName,
      mimeType: mimeTypeFor(originalName),
      sizeBytes: file.sizeBytes,
    })
  }
}

const MIME_TYPES: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  zip: 'application/zip',
  eml: 'message/rfc822',
}

const UNKNOWN_MIME_TYPE = 'application/octet-stream'

/** The media type of a file, from its extension: 'invoice.PDF' → 'application/pdf'. */
export function mimeTypeFor(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) return UNKNOWN_MIME_TYPE
  return MIME_TYPES[fileName.slice(dot + 1).toLowerCase()] ?? UNKNOWN_MIME_TYPE
}

/** A sensible preselection in the form: images are photos, anything else "Other". */
export function guessDocumentType(fileName: string): DocumentType {
  return mimeTypeFor(fileName).startsWith('image/') ? 'photo' : 'other'
}
