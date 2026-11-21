<script setup lang="ts">
import { computed } from 'vue'
import ActionsMenu from '@/components/common/ActionsMenu.vue'
import ListRow from '@/components/common/ListRow.vue'
import MetaList from '@/components/common/MetaList.vue'
import { t } from '@/i18n'
import { DOCUMENT_TYPE_ICONS, documentTypeLabel, type Attachment } from '@/types/attachment'
import { formatDate } from '@/utils/date'
import { formatFileSize } from '@/utils/file-size'

const props = defineProps<{
  attachment: Attachment
}>()

const emit = defineEmits<{
  open: [attachment: Attachment]
  edit: [attachment: Attachment]
  delete: [attachment: Attachment]
}>()

/** "Invoice", "4 Nov 2026", "1.2 MB". */
const details = computed<(string | null)[]>(() => {
  const { documentType, documentDate, sizeBytes } = props.attachment
  return [documentTypeLabel(documentType), documentDate && formatDate(documentDate), formatFileSize(sizeBytes)]
})

const actions = computed(() => [
  { title: t('common.open'), icon: 'mdi-open-in-new', onSelect: () => emit('open', props.attachment) },
  { title: t('documents.editDetails'), icon: 'mdi-pencil-outline', onSelect: () => emit('edit', props.attachment) },
  {
    title: t('common.delete'),
    icon: 'mdi-trash-can-outline',
    danger: true,
    onSelect: () => emit('delete', props.attachment),
  },
])
</script>

<template>
  <ListRow
    clickable
    v-bind="{ title: t('documents.openFile', { name: attachment.originalName }) }"
    @open="emit('open', attachment)"
  >
    <template #prepend>
      <v-icon :icon="DOCUMENT_TYPE_ICONS[attachment.documentType]" size="20" class="text-medium-emphasis" />
    </template>

    <div class="hb-body text-truncate">{{ attachment.originalName }}</div>
    <MetaList :items="details" />
    <p v-if="attachment.notes" class="attachment-item__notes hb-caption text-medium-emphasis">{{ attachment.notes }}</p>

    <template #append>
      <ActionsMenu :label="t('common.actionsFor', { name: attachment.originalName })" :actions="actions" />
    </template>
  </ListRow>
</template>

<style scoped>
.attachment-item__notes {
  white-space: pre-wrap;
  /* Long links have no break points and would widen the row beyond the window. */
  overflow-wrap: anywhere;
}
</style>
