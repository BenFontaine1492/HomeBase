<script setup lang="ts">
import { computed } from 'vue'
import { DOCUMENT_TYPE_ICONS, DOCUMENT_TYPE_LABELS, type Attachment } from '@/types/attachment'
import { formatDate } from '@/utils/date'
import { formatFileSize } from '@/utils/file-size'

const props = defineProps<{
  attachment: Attachment
}>()

defineEmits<{
  open: [attachment: Attachment]
  edit: [attachment: Attachment]
  delete: [attachment: Attachment]
}>()

const details = computed<string>(() => {
  const { documentType, documentDate, sizeBytes } = props.attachment
  return [DOCUMENT_TYPE_LABELS[documentType], documentDate && formatDate(documentDate), formatFileSize(sizeBytes)]
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <div
    class="attachment-item"
    role="button"
    tabindex="0"
    :title="`Open ${attachment.originalName}`"
    @click="$emit('open', attachment)"
    @keydown.enter.self="$emit('open', attachment)"
  >
    <div class="attachment-item__icon">
      <v-icon :icon="DOCUMENT_TYPE_ICONS[attachment.documentType]" size="20" color="primary" />
    </div>
    <div class="attachment-item__content">
      <div class="attachment-item__name">{{ attachment.originalName }}</div>
      <div class="attachment-item__details">{{ details }}</div>
      <div v-if="attachment.notes" class="attachment-item__notes">{{ attachment.notes }}</div>
    </div>
    <div @click.stop @keydown.stop>
      <v-menu location="bottom end">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="{ ...menuProps, 'aria-label': `Actions for ${attachment.originalName}` }"
            icon="mdi-dots-vertical"
            variant="text"
            size="small"
            density="comfortable"
          />
        </template>
        <v-list density="compact" min-width="160" rounded="lg">
          <v-list-item prepend-icon="mdi-open-in-new" title="Open" @click="$emit('open', attachment)" />
          <v-list-item prepend-icon="mdi-pencil-outline" title="Edit details" @click="$emit('edit', attachment)" />
          <v-list-item
            prepend-icon="mdi-trash-can-outline"
            title="Delete"
            base-color="error"
            @click="$emit('delete', attachment)"
          />
        </v-list>
      </v-menu>
    </div>
  </div>
</template>

<style scoped>
.attachment-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 24px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.attachment-item:hover,
.attachment-item:focus-visible {
  background: rgba(var(--v-theme-primary), 0.03);
  outline: none;
}

.attachment-item__icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.attachment-item__content {
  flex: 1;
  min-width: 0;
}

.attachment-item__name {
  overflow: hidden;
  font-size: 0.9375rem;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.attachment-item__details,
.attachment-item__notes {
  margin-top: 2px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.attachment-item__notes {
  white-space: pre-wrap;
}
</style>
