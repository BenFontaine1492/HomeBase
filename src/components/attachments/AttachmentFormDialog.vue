<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import DateField from '@/components/common/DateField.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useAttachments } from '@/composables/useAttachments'
import { t } from '@/i18n'
import {
  DOCUMENT_TYPES,
  documentTypeLabel,
  guessDocumentType,
  type Attachment,
  type AttachmentDetailsInput,
  type AttachmentOwner,
  type DocumentType,
} from '@/types/attachment'

/**
 * Details of a document. With `sourcePath` (a file the user just picked) it adds
 * that file to `owner`; with `attachment` it edits that document's details.
 */
const props = defineProps<{
  owner: AttachmentOwner
  sourcePath?: string | null
  attachment?: Attachment | null
}>()

const open = defineModel<boolean>({ required: true })

const { addAttachment, updateAttachment } = useAttachments()
const { isRunning: isSaving, error: submitError, run } = useAsyncAction()
const formId = useId()

interface FormState {
  documentType: DocumentType
  documentDate: string
  notes: string
}

const form = reactive<FormState>({ documentType: 'other', documentDate: '', notes: '' })

const typeOptions = computed(() => DOCUMENT_TYPES.map((type) => ({ title: documentTypeLabel(type), value: type })))

/** The file name of the picked file, or of the document being edited. */
const fileName = computed<string>(() => props.attachment?.originalName ?? props.sourcePath?.split(/[\\/]/).pop() ?? '')

watch(open, (isOpen) => {
  if (!isOpen) return
  const { attachment } = props
  Object.assign(form, {
    documentType: attachment?.documentType ?? guessDocumentType(fileName.value),
    documentDate: attachment?.documentDate ?? '',
    notes: attachment?.notes ?? '',
  } satisfies FormState)
  submitError.value = null
})

function submit(): Promise<void> {
  const input: AttachmentDetailsInput = { ...form }
  const { attachment, sourcePath, owner } = props
  return run(async () => {
    if (attachment) await updateAttachment(attachment.id, input)
    else if (sourcePath) await addAttachment(owner, sourcePath, input)
    open.value = false
  })
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="attachment ? t('documents.form.editTitle') : t('documents.form.addTitle')"
    :subtitle="fileName"
    :busy="isSaving"
  >
    <v-form v-bind="{ id: formId }" @submit.prevent="submit">
      <v-select v-model="form.documentType" :label="t('common.type')" :items="typeOptions" />
      <DateField v-model="form.documentDate" :label="t('documents.form.date')" :hint="t('documents.form.dateHint')" />
      <v-textarea v-model="form.notes" :label="t('common.notes')" rows="2" auto-grow />
    </v-form>
    <v-alert v-if="submitError" type="error" density="compact" class="mt-4">{{ submitError }}</v-alert>

    <template #actions>
      <v-btn v-bind="{ type: 'submit', form: formId }" color="primary" variant="flat" :loading="isSaving">
        {{ attachment ? t('common.saveChanges') : t('documents.form.addTitle') }}
      </v-btn>
      <v-btn :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>
