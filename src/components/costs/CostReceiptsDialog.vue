<script setup lang="ts">
import AttachmentList from '@/components/attachments/AttachmentList.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import { t } from '@/i18n'
import type { Cost } from '@/types/cost'
import { formatCents } from '@/utils/currency'
import { formatDate } from '@/utils/date'

/** The receipts (documents) of one cost. */
defineProps<{
  cost: Cost | null
  /** What the cost was for (its title in the list). */
  title: string
}>()

const open = defineModel<boolean>({ required: true })
</script>

<template>
  <AppDialog
    v-model="open"
    :title="t('costs.receipts.title')"
    :subtitle="
      cost
        ? t('costs.receipts.subtitle', {
            title,
            amount: formatCents(cost.amountCents),
            date: formatDate(cost.paidDate),
          })
        : undefined
    "
    size="large"
  >
    <AttachmentList
      v-if="cost"
      :owner="{ kind: 'cost', id: cost.id }"
      :empty-title="t('costs.receipts.emptyTitle')"
      :empty-text="t('costs.receipts.emptyText')"
    />
    <template #actions>
      <v-btn :text="t('common.close')" v-bind="{ onClick: () => (open = false) }" />
    </template>
  </AppDialog>
</template>
