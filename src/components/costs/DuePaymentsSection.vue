<script setup lang="ts">
import ListRow from '@/components/common/ListRow.vue'
import ListSection from '@/components/common/ListSection.vue'
import MetaList from '@/components/common/MetaList.vue'
import { t } from '@/i18n'
import type { DuePayment } from '@/types/recurring-cost'
import { formatCents } from '@/utils/currency'
import { formatDate } from '@/utils/date'

/** The payments of recurring costs that are due: "Paid…" records one, "Skip" passes it over. */
defineProps<{
  payments: readonly DuePayment[]
  /** The payment being skipped (its button shows progress). */
  skipping: DuePayment | null
}>()

const emit = defineEmits<{
  paid: [payment: DuePayment]
  skip: [payment: DuePayment]
}>()
</script>

<template>
  <ListSection :title="t('costs.due.title')" :count="payments.length" :subtitle="t('costs.due.subtitle')">
    <ListRow v-for="payment in payments" :key="`${payment.rule.id}-${payment.dueDate}`">
      <template #prepend>
        <v-icon icon="mdi-calendar-alert" size="24" color="warning" />
      </template>
      <div class="hb-body">{{ payment.rule.description }}</div>
      <MetaList
        :items="[
          t('costs.due.dueOn', { date: formatDate(payment.dueDate) }),
          payment.moreCount > 0 && t('costs.due.more', { count: payment.moreCount }),
          payment.rule.payee,
        ]"
      />

      <template #append>
        <div class="hb-body-strong hb-numeric">{{ formatCents(payment.rule.amountCents) }}</div>
        <v-btn size="small" :text="t('costs.due.paid')" v-bind="{ onClick: () => emit('paid', payment) }" />
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
