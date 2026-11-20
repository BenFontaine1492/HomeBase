<script setup lang="ts">
import { computed } from 'vue'
import ActionsMenu from '@/components/common/ActionsMenu.vue'
import ListRow from '@/components/common/ListRow.vue'
import MetaList from '@/components/common/MetaList.vue'
import { t } from '@/i18n'
import type { MaintenanceRecord } from '@/types/maintenance-record'
import { formatCents } from '@/utils/currency'
import { formatDate } from '@/utils/date'

const props = defineProps<{
  record: MaintenanceRecord
  /** Name of the record's task; null = no task (one-off work, or the task was deleted). */
  taskName: string | null
  receiptCount: number
}>()

const emit = defineEmits<{
  receipts: [record: MaintenanceRecord]
  edit: [record: MaintenanceRecord]
  delete: [record: MaintenanceRecord]
}>()

const actions = computed(() => [
  { title: t('maintenance.receipts.title'), icon: 'mdi-paperclip', onSelect: () => emit('receipts', props.record) },
  { title: t('common.edit'), icon: 'mdi-pencil-outline', onSelect: () => emit('edit', props.record) },
  {
    title: t('common.delete'),
    icon: 'mdi-trash-can-outline',
    danger: true,
    onSelect: () => emit('delete', props.record),
  },
])
</script>

<template>
  <ListRow>
    <div class="hb-body">{{ taskName ?? t('maintenance.otherWork') }}</div>
    <MetaList :items="[formatDate(record.date), record.provider]" />
    <p v-if="record.notes" class="record-item__notes hb-caption text-medium-emphasis">{{ record.notes }}</p>

    <template #append>
      <div class="record-item__cost hb-body-strong hb-numeric">
        <template v-if="record.costCents !== null">{{ formatCents(record.costCents) }}</template>
      </div>
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-paperclip"
        v-bind="{ onClick: () => emit('receipts', record), title: t('maintenance.receipts.title') }"
      >
        {{ receiptCount }}
      </v-btn>
      <ActionsMenu :label="t('maintenance.entryActions')" :actions="actions" />
    </template>
  </ListRow>
</template>

<style scoped>
.record-item__notes {
  white-space: pre-wrap;
}

.record-item__cost {
  min-width: 80px;
  text-align: right;
}
</style>
