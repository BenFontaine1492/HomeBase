<script setup lang="ts">
import { computed } from 'vue'
import type { MaintenanceRecord } from '@/types/maintenance-record'
import { formatCents } from '@/utils/currency'
import { formatDate } from '@/utils/date'

const props = defineProps<{
  record: MaintenanceRecord
  /** Name of the record's task; null = no task (one-off work, or the task was deleted). */
  taskName: string | null
  receiptCount: number
}>()

defineEmits<{
  receipts: [record: MaintenanceRecord]
  edit: [record: MaintenanceRecord]
  delete: [record: MaintenanceRecord]
}>()

const subtitle = computed<string>(() =>
  [formatDate(props.record.date), props.record.provider].filter(Boolean).join(' · '),
)
</script>

<template>
  <div class="record-item">
    <div class="record-item__content">
      <div class="record-item__title" :class="{ 'record-item__title--other': taskName === null }">
        {{ taskName ?? 'Other work' }}
      </div>
      <div class="record-item__subtitle">{{ subtitle }}</div>
      <div v-if="record.notes" class="record-item__notes">{{ record.notes }}</div>
    </div>
    <div class="record-item__cost">
      <template v-if="record.costCents !== null">{{ formatCents(record.costCents) }}</template>
    </div>
    <v-btn
      variant="text"
      size="small"
      prepend-icon="mdi-paperclip"
      v-bind="{ onClick: () => $emit('receipts', record), title: 'Receipts' }"
    >
      {{ receiptCount }}
    </v-btn>
    <v-menu location="bottom end">
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="{ ...menuProps, 'aria-label': 'Actions for this entry' }"
          icon="mdi-dots-vertical"
          variant="text"
          size="small"
          density="comfortable"
        />
      </template>
      <v-list density="compact" min-width="160" rounded="lg">
        <v-list-item prepend-icon="mdi-paperclip" title="Receipts" @click="$emit('receipts', record)" />
        <v-list-item prepend-icon="mdi-pencil-outline" title="Edit" @click="$emit('edit', record)" />
        <v-list-item
          prepend-icon="mdi-trash-can-outline"
          title="Delete"
          base-color="error"
          @click="$emit('delete', record)"
        />
      </v-list>
    </v-menu>
  </div>
</template>

<style scoped>
.record-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
}

.record-item__content {
  flex: 1;
  min-width: 0;
}

.record-item__title {
  font-size: 0.9375rem;
  font-weight: 600;
}

.record-item__title--other {
  font-style: italic;
}

.record-item__subtitle,
.record-item__notes {
  margin-top: 2px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.record-item__notes {
  white-space: pre-wrap;
}

.record-item__cost {
  flex-shrink: 0;
  min-width: 80px;
  font-size: 0.9375rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
