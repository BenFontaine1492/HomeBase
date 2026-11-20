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
    <div class="hb-body-strong text-truncate" v-bind="{ title: info.path }">{{ info.path }}</div>
    <div v-if="createdLabel" class="hb-caption text-medium-emphasis">
      {{ t('settings.data.created', { date: createdLabel }) }}
    </div>

    <div class="file-summary__counts">
      <div v-for="table in info.tables" :key="table.name" class="file-summary__count hb-caption">
        <span>{{ tableLabel(table.name) }}</span>
        <strong class="hb-numeric">{{ table.rows }}</strong>
      </div>
    </div>

    <div v-if="isOlderSchema" class="file-summary__note hb-caption text-medium-emphasis">
      <v-icon icon="mdi-information-outline" size="16" />
      {{ t('settings.data.olderVersion') }}
    </div>
  </div>
</template>

<style scoped>
.file-summary {
  padding: 12px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-surface-variant));
}

.file-summary__counts {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}

.file-summary__count {
  display: flex;
  justify-content: space-between;
}

.file-summary__note {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}
</style>
