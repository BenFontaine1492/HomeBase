<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AttachmentFormDialog from './AttachmentFormDialog.vue'
import AttachmentListItem from './AttachmentListItem.vue'
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
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
  <div>
    <div class="attachment-list__toolbar">
      <span class="attachment-list__count">
        {{ t('common.documentCount', { count: attachments.length }) }}
      </span>
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-paperclip" v-bind="{ onClick: addDocument }">
        {{ t('documents.addEllipsis') }}
      </v-btn>
    </div>

    <v-alert
      v-if="actionError"
      type="error"
      density="compact"
      class="mx-6 mb-4"
      closable
      @click:close="actionError = null"
    >
      {{ actionError }}
    </v-alert>
    <v-alert v-if="store.error.value" type="error" density="compact" class="mx-6 mb-4">
      {{ t('documents.loadError', { error: store.error.value }) }}
    </v-alert>

    <v-divider />

    <EmptyState
      v-if="attachments.length === 0"
      icon="mdi-file-document-outline"
      :title="emptyTitle"
      :text="emptyText"
    />
    <div v-else>
      <template v-for="(attachment, index) in attachments" :key="attachment.id">
        <v-divider v-if="index > 0" />
        <AttachmentListItem
          :attachment="attachment"
          @open="openDocument"
          @edit="editDocument"
          @delete="confirmDelete"
        />
      </template>
    </div>

    <AttachmentFormDialog
      v-model="isFormOpen"
      :owner="owner"
      :source-path="pickedPath"
      :attachment="attachmentToEdit"
    />
    <ConfirmDeleteDialog v-model="isDeleteOpen" :title="t('documents.delete.title')" :action="deleteDocument">
      {{ t('documents.delete.text', { name: attachmentToDelete?.originalName ?? '' }) }}
    </ConfirmDeleteDialog>
  </div>
</template>

<style scoped>
.attachment-list__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
}

.attachment-list__count {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
