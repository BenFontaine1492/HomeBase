import type { StoredAttachmentFile } from '@/types/attachment'
import { callCommand } from './native-command'

/*
 * The native attachment commands (`src-tauri/src/attachments/`): copying a file
 * into the app's attachments/ folder and opening a stored file. The frontend
 * never passes a path into that folder; files are opened by attachment id.
 */

/** Copies `source` (from a file dialog) into attachments/ under a new unique name. */
export function storeAttachmentFile(source: string): Promise<StoredAttachmentFile> {
  return callCommand('store_attachment_file', { source })
}

/** Opens the file of attachment `id` with the system's default app. */
export function openAttachment(id: number): Promise<void> {
  return callCommand('open_attachment', { id })
}
