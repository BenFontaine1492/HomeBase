<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AttachmentFormDialog from './AttachmentFormDialog.vue'
import AttachmentListItem from './AttachmentListItem.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ListSection from '@/components/common/ListSection.vue'
import { useAttachments } from '@/composables/useAttachments'
import { t } from '@/i18n'
import type { Attachment, AttachmentOwner } from '@/types/attachment'
import { describeError } from '@/utils/error'

/**
 * The documents of one owner (an object, or a maintenance entry's receipts),
 * with add / open / edit / delete.
 */
const props = defineProps<{
  owner: AttachmentOwner
  emptyTitle: string
  emptyText: string
}>()

const store = useAttachments()

const attachments = computed(() => store.attachmentsOf(props.owner))
/** Errors of picking and opening files (the dialogs show their own). */
const actionError = ref<string | null>(null)

const isFormOpen = ref(false)
const pickedPath = ref<string | null>(null)
const attachmentToEdit = ref<Attachment | null>(null)
const isDeleteOpen = ref(false)
const attachmentToDelete = ref<Attachment | null>(null)

async function runAction(action: () => Promise<void>): Promise<void> {
  actionError.value = null
  try {
    await action()
  } catch (error) {
    console.error(error)
    actionError.value = describeError(error)
  }
}

function addDocument(): Promise<void> {
  return runAction(async () => {
    const path = await store.pickFile()
    if (!path) return
    pickedPath.value = path
    attachmentToEdit.value = null
    isFormOpen.value = true
  })
}

function openDocument(attachment: Attachment): Promise<void> {
  return runAction(() => store.openAttachment(attachment.id))
}

function editDocument(attachment: Attachment): void {
  pickedPath.value = null
  attachmentToEdit.value = attachment
  isFormOpen.value = true
}

function confirmDelete(attachment: Attachment): void {
  attachmentToDelete.value = attachment
  isDeleteOpen.value = true
}

async function deleteDocument(): Promise<void> {
  if (attachmentToDelete.value) await store.deleteAttachment(attachmentToDelete.value.id)
}

onMounted(() => {
  void store.ensureLoaded()
})
</script>

<template>
  <ListSection :title="t('common.documentCount', { count: attachments.length })">
    <template #actions>
      <v-btn size="small" prepend-icon="mdi-paperclip" v-bind="{ onClick: addDocument }">
        {{ t('documents.addEllipsis') }}
      </v-btn>
    </template>

    <v-alert v-if="actionError" type="error" density="compact" closable @click:close="actionError = null">
      {{ actionError }}
    </v-alert>
    <v-alert v-if="store.error.value" type="error" density="compact">
      {{ t('documents.loadError', { error: store.error.value }) }}
    </v-alert>

    <v-card v-if="attachments.length === 0">
      <EmptyState icon="mdi-file-document-outline" :title="emptyTitle" :text="emptyText" />
    </v-card>
    <AttachmentListItem
      v-for="attachment in attachments"
      :key="attachment.id"
      :attachment="attachment"
      @open="openDocument"
      @edit="editDocument"
      @delete="confirmDelete"
    />
  </ListSection>

  <AttachmentFormDialog v-model="isFormOpen" :owner="owner" :source-path="pickedPath" :attachment="attachmentToEdit" />
  <ConfirmDialog v-model="isDeleteOpen" :title="t('documents.delete.title')" :action="deleteDocument">
    {{ t('documents.delete.text', { name: attachmentToDelete?.originalName ?? '' }) }}
  </ConfirmDialog>
</template>
