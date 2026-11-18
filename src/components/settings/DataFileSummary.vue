<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import { tableLabel, type BackupInfo } from '@/types/data-transfer'
import { formatDateTime } from '@/utils/date'

const props = defineProps<{
  info: BackupInfo
  /** ISO timestamp shown as "Created …" when known. */
  createdAt?: string
}>()

const createdLabel = computed<string | null>(() => {
  if (!props.createdAt) return null
  const date = new Date(props.createdAt)
  return Number.isNaN(date.getTime()) ? null : formatDateTime(date)
})

const isOlderSchema = computed<boolean>(() => props.info.schemaVersion < props.info.appSchemaVersion)
</script>

<template>
  <div class="file-summary">
    <div class="file-summary__path" :title="info.path">{{ info.path }}</div>
    <div v-if="createdLabel" class="file-summary__meta">{{ t('settings.data.created', { date: createdLabel }) }}</div>

    <div class="file-summary__counts">
      <div v-for="table in info.tables" :key="table.name" class="file-summary__count">
        <span>{{ tableLabel(table.name) }}</span>
        <strong>{{ table.rows }}</strong>
      </div>
    </div>

    <div v-if="isOlderSchema" class="file-summary__meta mt-2">
      <v-icon icon="mdi-information-outline" size="16" class="mr-1" />
      {{ t('settings.data.olderVersion') }}
    </div>
  </div>
</template>

<style scoped>
.file-summary {
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.file-summary__path {
  overflow: hidden;
  font-size: 0.8125rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-summary__meta {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.file-summary__counts {
  margin-top: 10px;
}

.file-summary__count {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
  font-size: 0.8125rem;
}
</style>
