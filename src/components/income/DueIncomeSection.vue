<script setup lang="ts">
import ListRow from '@/components/common/ListRow.vue'
import ListSection from '@/components/common/ListSection.vue'
import MetaList from '@/components/common/MetaList.vue'
import { t } from '@/i18n'
import type { DueIncome } from '@/types/recurring-income'
import { formatCents } from '@/utils/currency'
import { formatDate } from '@/utils/date'

/** The payments of recurring income that are due: "Received…" records one, "Skip" passes it over. */
defineProps<{
  payments: readonly DueIncome[]
  /** The payment being skipped (its button shows progress). */
  skipping: DueIncome | null
}>()

const emit = defineEmits<{
  received: [payment: DueIncome]
  skip: [payment: DueIncome]
}>()
</script>

<template>
  <ListSection :title="t('income.due.title')" :count="payments.length" :subtitle="t('income.due.subtitle')">
    <ListRow v-for="payment in payments" :key="`${payment.rule.id}-${payment.dueDate}`">
      <template #prepend>
        <v-icon icon="mdi-calendar-alert" size="24" color="warning" />
      </template>
      <div class="hb-body">{{ payment.rule.description }}</div>
      <MetaList
        :items="[
          t('costs.due.dueOn', { date: formatDate(payment.dueDate) }),
          payment.moreCount > 0 && t('costs.due.more', { count: payment.moreCount }),
          payment.rule.payer,
        ]"
      />

      <template #append>
        <div class="hb-body-strong hb-numeric">{{ formatCents(payment.rule.amountCents) }}</div>
        <v-btn size="small" :text="t('income.due.received')" v-bind="{ onClick: () => emit('received', payment) }" />
        <v-btn
          size="small"
          variant="text"
          :text="t('costs.due.skip')"
          :loading="skipping === payment"
          v-bind="{ onClick: () => emit('skip', payment) }"
        />
      </template>
    </ListRow>
  </ListSection>
</template>
