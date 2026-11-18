import { execute, select } from '@/infrastructure/database'
import { insertedId, rethrowConstraintError } from './repository-errors'
import type {
  Attachment,
  AttachmentDetailsValues,
  AttachmentOwnerKind,
  AttachmentValues,
  DocumentType,
} from '@/types/attachment'

/*
 * Metadata of documents. The files are copied and opened natively
 * (attachment-file.repository.ts). Deleting a row leaves its file behind; the
 * native startup cleanup removes files without a row.
 */

/**
 * The owner column of each owner kind. A new owner (e.g. expenses) needs a new
 * column (migration, see 0005) and an entry here and in `OWNER_KIND_SQL`.
 */
const OWNER_COLUMNS: Readonly<Record<AttachmentOwnerKind, string>> = {
  object: 'household_object_id',
  'maintenance-record': 'maintenance_record_id',
}

/** The owner as one kind + id pair (exactly one owner column is set, see migration 0005). */
const OWNER_KIND_SQL = `CASE WHEN household_object_id IS NOT NULL THEN 'object' ELSE 'maintenance-record' END`
const OWNER_ID_SQL = 'coalesce(household_object_id, maintenance_record_id)'

interface AttachmentRow {
  id: number
  owner_kind: AttachmentOwnerKind
  owner_id: number
  stored_name: string
  original_name: string
  mime_type: string
  size_bytes: number
  document_type: DocumentType
  document_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

function mapRow(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    owner: { kind: row.owner_kind, id: row.owner_id },
    storedName: row.stored_name,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    documentType: row.document_type,
    documentDate: row.document_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** All documents, newest first (by document date, else by when they were added). */
export async function findAll(): Promise<Attachment[]> {
  const rows = await select<AttachmentRow>(
    `SELECT id, ${OWNER_KIND_SQL} AS owner_kind, ${OWNER_ID_SQL} AS owner_id, stored_name, original_name,
            mime_type, size_bytes, document_type, document_date, notes, created_at, updated_at
       FROM attachments
      ORDER BY coalesce(document_date, substr(created_at, 1, 10)) DESC, id DESC`,
  )
  return rows.map(mapRow)
}

/** Inserts a document's row and returns its id. A missing owner throws `MissingReferenceError`. */
export async function insert(values: AttachmentValues): Promise<number> {
  const { owner, details } = values
  const result = await execute(
    `INSERT INTO attachments (${OWNER_COLUMNS[owner.kind]}, stored_name, original_name, mime_type, size_bytes,
                              document_type, document_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      owner.id,
      values.storedName,
      values.originalName,
      values.mimeType,
      values.sizeBytes,
      details.documentType,
      details.documentDate,
      details.notes,
    ],
  ).catch(rethrowConstraintError)
  return insertedId(result, 'document')
}

/** Updates the editable fields of a document. false = no such document. */
export async function update(id: number, details: AttachmentDetailsValues): Promise<boolean> {
  const result = await execute(
    `UPDATE attachments
        SET document_type = $1,
            document_date = $2,
            notes = $3,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = $4`,
    [details.documentType, details.documentDate, details.notes, id],
  )
  return result.rowsAffected > 0
}

/** Deletes a document's row (its file is removed by the startup cleanup). false = no such document. */
export async function remove(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM attachments WHERE id = $1', [id])
  return result.rowsAffected > 0
}
