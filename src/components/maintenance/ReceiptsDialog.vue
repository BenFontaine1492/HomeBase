<script setup lang="ts">
import AttachmentList from '@/components/attachments/AttachmentList.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import { t } from '@/i18n'
import type { MaintenanceRecord } from '@/types/maintenance-record'
import { formatDate } from '@/utils/date'

/** The receipts (documents) of one maintenance history entry. */
defineProps<{
  record: MaintenanceRecord | null
}>()

const open = defineModel<boolean>({ required: true })
</script>

<template>
  <AppDialog
    v-model="open"
    :title="t('maintenance.receipts.title')"
    :subtitle="record ? t('maintenance.receipts.subtitle', { date: formatDate(record.date) }) : undefined"
    size="large"
  >
    <AttachmentList
      v-if="record"
      :owner="{ kind: 'maintenance-record', id: record.id }"
      :empty-title="t('maintenance.receipts.emptyTitle')"
      :empty-text="t('maintenance.receipts.emptyText')"
    />
    <template #actions>
      <v-btn :text="t('common.close')" v-bind="{ onClick: () => (open = false) }" />
    </template>
  </AppDialog>
</template>
