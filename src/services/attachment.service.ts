import { open } from '@tauri-apps/plugin-dialog'
import * as fileRepository from '@/repositories/attachment-file.repository'
import * as attachmentRepository from '@/repositories/attachment.repository'
import {
  AttachmentDetailsValues,
  AttachmentValues,
  type Attachment,
  type AttachmentDetailsInput,
  type AttachmentOwner,
} from '@/types/attachment'
import { rethrowWithMessage } from './service-errors'

/*
 * Documents: the file is copied natively first, then its row is inserted. If the
 * insert fails, the copy has no row and the native startup cleanup removes it;
 * the same happens to the files of deleted documents.
 */

const OWNER_GONE: Readonly<Record<AttachmentOwner['kind'], string>> = {
  object: 'This object no longer exists.',
  'maintenance-record': 'This maintenance entry no longer exists.',
}

const DOCUMENT_GONE = 'This document no longer exists.'

/** Lets the user pick a file to attach. null = cancelled. */
export async function pickAttachmentFile(): Promise<string | null> {
  const path = await open({ title: 'Choose a document', multiple: false, directory: false })
  return typeof path === 'string' ? path : null
}

export function listAttachments(): Promise<Attachment[]> {
  return attachmentRepository.findAll()
}

/** Copies `sourcePath` into the app and attaches it to `owner`. Returns the new id. */
export async function addAttachment(
  owner: AttachmentOwner,
  sourcePath: string,
  input: AttachmentDetailsInput,
): Promise<number> {
  // Checked before copying, so a typo in the form doesn't copy the file.
  const details = AttachmentDetailsValues.from(input)
  const file = await fileRepository.storeAttachmentFile(sourcePath)
  return attachmentRepository
    .insert(AttachmentValues.from(owner, details, file))
    .catch(rethrowWithMessage({ missingReference: OWNER_GONE[owner.kind] }))
}

export async function updateAttachment(id: number, input: AttachmentDetailsInput): Promise<void> {
  if (!(await attachmentRepository.update(id, AttachmentDetailsValues.from(input)))) throw new Error(DOCUMENT_GONE)
}

/** Deletes a document. Its file is removed by the native cleanup at the next start. */
export async function deleteAttachment(id: number): Promise<void> {
  if (!(await attachmentRepository.remove(id))) throw new Error(DOCUMENT_GONE)
}

/** Opens the document with the system's default app. */
export function openAttachment(id: number): Promise<void> {
  return fileRepository.openAttachment(id)
}
