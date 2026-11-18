import { readonly, ref, type Ref } from 'vue'
import * as attachmentService from '@/services/attachment.service'
import { isSameOwner, type Attachment, type AttachmentDetailsInput, type AttachmentOwner } from '@/types/attachment'
import { describeError } from '@/utils/error'

// Module-level state: shared by every component that calls useAttachments().
/** Documents of all owners (a household has few enough to keep them all loaded). */
const attachments = ref<Attachment[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

/** The documents of one owner, newest first. */
function attachmentsOf(owner: AttachmentOwner): Attachment[] {
  return attachments.value.filter((attachment) => isSameOwner(attachment.owner, owner))
}

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    attachments.value = await attachmentService.listAttachments()
    hasLoaded = true
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  } finally {
    isLoading.value = false
  }
}

async function ensureLoaded(): Promise<void> {
  if (!hasLoaded && !isLoading.value) await refresh()
}

// Write operations reload the list afterwards and rethrow errors for the dialogs.

/** Copies the file at `sourcePath` into the app and attaches it to `owner`. */
async function addAttachment(owner: AttachmentOwner, sourcePath: string, input: AttachmentDetailsInput): Promise<void> {
  await attachmentService.addAttachment(owner, sourcePath, input)
  await refresh()
}

async function updateAttachment(id: number, input: AttachmentDetailsInput): Promise<void> {
  await attachmentService.updateAttachment(id, input)
  await refresh()
}

async function deleteAttachment(id: number): Promise<void> {
  await attachmentService.deleteAttachment(id)
  await refresh()
}

export interface UseAttachments {
  attachments: Readonly<Ref<readonly Attachment[]>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  attachmentsOf: (owner: AttachmentOwner) => Attachment[]
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  /** Opens the native file picker; null = cancelled. */
  pickFile: () => Promise<string | null>
  addAttachment: (owner: AttachmentOwner, sourcePath: string, input: AttachmentDetailsInput) => Promise<void>
  updateAttachment: (id: number, input: AttachmentDetailsInput) => Promise<void>
  deleteAttachment: (id: number) => Promise<void>
  /** Opens the document with the system's default app. */
  openAttachment: (id: number) => Promise<void>
}

export function useAttachments(): UseAttachments {
  return {
    attachments: readonly(attachments) as Readonly<Ref<readonly Attachment[]>>,
    isLoading: readonly(isLoading),
    error: readonly(error),
    attachmentsOf,
    refresh,
    ensureLoaded,
    pickFile: attachmentService.pickAttachmentFile,
    addAttachment,
    updateAttachment,
    deleteAttachment,
    openAttachment: attachmentService.openAttachment,
  }
}
