<script setup lang="ts">
import AttachmentList from '@/components/attachments/AttachmentList.vue'
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
  <v-dialog v-model="open" max-width="640">
    <v-card v-if="record" class="pb-2">
      <v-card-title class="text-title-large font-weight-bold pt-5 px-6">{{
        t('maintenance.receipts.title')
      }}</v-card-title>
      <v-card-subtitle class="px-6">{{
        t('maintenance.receipts.subtitle', { date: formatDate(record.date) })
      }}</v-card-subtitle>
      <AttachmentList
        :owner="{ kind: 'maintenance-record', id: record.id }"
        :empty-title="t('maintenance.receipts.emptyTitle')"
        :empty-text="t('maintenance.receipts.emptyText')"
      />
      <v-card-actions class="px-6">
        <v-spacer />
        <v-btn variant="text" v-bind="{ onClick: () => (open = false) }">{{ t('common.close') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
