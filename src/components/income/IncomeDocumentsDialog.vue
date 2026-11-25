<script setup lang="ts">
import AttachmentList from '@/components/attachments/AttachmentList.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import { t } from '@/i18n'
import type { Income } from '@/types/income'
import { formatCents } from '@/utils/currency'
import { formatDate } from '@/utils/date'

/** The documents (statements, settlements) of one income entry. */
defineProps<{
  income: Income | null
}>()

const open = defineModel<boolean>({ required: true })
</script>

<template>
  <AppDialog
    v-model="open"
    :title="t('income.documents.title')"
    :subtitle="
      income
        ? t('income.documents.subtitle', {
            title: income.description,
            amount: formatCents(income.amountCents),
            date: formatDate(income.receivedDate),
          })
        : undefined
    "
    size="large"
  >
    <AttachmentList
      v-if="income"
      :owner="{ kind: 'income', id: income.id }"
      :empty-title="t('income.documents.emptyTitle')"
      :empty-text="t('income.documents.emptyText')"
    />
    <template #actions>
      <v-btn :text="t('common.close')" v-bind="{ onClick: () => (open = false) }" />
    </template>
  </AppDialog>
</template>
