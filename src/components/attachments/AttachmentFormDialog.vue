<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
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
import { describeError } from '@/utils/error'

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

interface FormState {
  documentType: DocumentType
  documentDate: string
  notes: string
}

const form = reactive<FormState>({ documentType: 'other', documentDate: '', notes: '' })
const isSaving = ref(false)
const submitError = ref<string | null>(null)

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

async function submit(): Promise<void> {
  if (isSaving.value) return
  isSaving.value = true
  submitError.value = null
  const input: AttachmentDetailsInput = { ...form }
  try {
    if (props.attachment) await updateAttachment(props.attachment.id, input)
    else if (props.sourcePath) await addAttachment(props.owner, props.sourcePath, input)
    open.value = false
  } catch (error) {
    console.error(error)
    submitError.value = describeError(error)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="520" :persistent="isSaving">
    <v-card class="pa-2">
      <v-card-title class="text-title-large font-weight-bold pt-4 px-6">
        {{ attachment ? t('documents.form.editTitle') : t('documents.form.addTitle') }}
      </v-card-title>
      <v-card-subtitle class="px-6 attachment-form__file">
        <v-icon icon="mdi-paperclip" size="16" class="mr-1" />{{ fileName }}
      </v-card-subtitle>

      <v-form class="px-6 pt-6" @submit.prevent="submit">
        <v-select v-model="form.documentType" :label="t('common.type')" :items="typeOptions" />
        <v-text-field
          v-model="form.documentDate"
          :label="t('documents.form.date')"
          type="date"
          :hint="t('documents.form.dateHint')"
          persistent-hint
          class="mb-4"
        />
        <v-textarea v-model="form.notes" :label="t('common.notes')" rows="2" auto-grow />

        <v-alert v-if="submitError" type="error" class="mb-4" density="compact">
          {{ submitError }}
        </v-alert>

        <v-card-actions class="px-0 pb-4">
          <v-spacer />
          <v-btn variant="text" :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{
            t('common.cancel')
          }}</v-btn>
          <v-btn v-bind="{ type: 'submit' }" color="primary" variant="flat" :loading="isSaving">
            {{ attachment ? t('common.saveChanges') : t('documents.form.addTitle') }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.attachment-form__file {
  overflow-wrap: anywhere;
  white-space: normal;
}

.attachment-form__hint {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
