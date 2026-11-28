<script setup lang="ts">
import { computed } from 'vue'
import ActionsMenu from '@/components/common/ActionsMenu.vue'
import ListRow from '@/components/common/ListRow.vue'
import MetaList from '@/components/common/MetaList.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { t } from '@/i18n'
import { intervalLabel } from '@/types/maintenance-task'
import type { RecurringCost } from '@/types/recurring-cost'
import { isFinished } from '@/types/recurring-schedule'
import { formatCents } from '@/utils/currency'
import { formatDate } from '@/utils/date'

const props = defineProps<{
  rule: RecurringCost
}>()

const emit = defineEmits<{
  edit: [rule: RecurringCost]
  delete: [rule: RecurringCost]
}>()

const schedule = computed<string>(() =>
  isFinished(props.rule)
    ? t('costs.recurring.ended', { date: formatDate(props.rule.endDate ?? props.rule.nextDueDate) })
    : t('costs.recurring.nextDue', { date: formatDate(props.rule.nextDueDate) }),
)

const actions = computed(() => [
  { title: t('common.edit'), icon: 'mdi-pencil-outline', onSelect: () => emit('edit', props.rule) },
  {
    title: t('common.delete'),
    icon: 'mdi-trash-can-outline',
    danger: true,
    onSelect: () => emit('delete', props.rule),
  },
])
</script>

<template>
  <ListRow>
    <template #prepend>
      <v-icon icon="mdi-cash-minus" size="24" class="text-medium-emphasis" />
    </template>
    <div class="hb-body">{{ rule.description }}</div>
    <MetaList :items="[intervalLabel(rule), schedule, rule.category, rule.payee]">
      <StatusBadge v-if="rule.autopay" color="info" icon="mdi-autorenew">{{
        t('costs.recurring.autopay')
      }}</StatusBadge>
    </MetaList>

    <template #append>
      <div class="hb-body-strong hb-numeric">{{ formatCents(rule.amountCents) }}</div>
      <ActionsMenu :label="t('common.actionsFor', { name: rule.description })" :actions="actions" />
    </template>
  </ListRow>
</template>
