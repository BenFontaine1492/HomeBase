<script setup lang="ts">
import { computed } from 'vue'
import ActionsMenu from '@/components/common/ActionsMenu.vue'
import ListRow from '@/components/common/ListRow.vue'
import MetaList from '@/components/common/MetaList.vue'
import { t } from '@/i18n'
import { paymentMethodLabel, type Cost } from '@/types/cost'
import { formatCents } from '@/utils/currency'
import { formatDate } from '@/utils/date'

const props = defineProps<{
  cost: Cost
  /** What the cost was for: its description, or the maintenance work it belongs to. */
  title: string
  objectName: string | null
  receiptCount: number
}>()

const emit = defineEmits<{
  receipts: [cost: Cost]
  edit: [cost: Cost]
  delete: [cost: Cost]
}>()

/** A maintenance cost shows a wrench, a purchase a cart, any other cost a bill. */
const icon = computed<string>(() => {
  if (props.cost.maintenanceRecordId !== null) return 'mdi-wrench-outline'
  return props.cost.investmentId === null ? 'mdi-cash-minus' : 'mdi-cart-outline'
})

const actions = computed(() => [
  { title: t('costs.receipts.title'), icon: 'mdi-paperclip', onSelect: () => emit('receipts', props.cost) },
  { title: t('common.edit'), icon: 'mdi-pencil-outline', onSelect: () => emit('edit', props.cost) },
  {
    title: t('common.delete'),
    icon: 'mdi-trash-can-outline',
    danger: true,
    onSelect: () => emit('delete', props.cost),
  },
])
</script>

<template>
  <ListRow>
    <template #prepend>
      <v-icon :icon="icon" size="24" class="text-medium-emphasis" />
    </template>
    <div class="hb-body">{{ title }}</div>
    <MetaList
      :items="[
        formatDate(cost.paidDate),
        cost.category,
        cost.payee,
        objectName,
        cost.paymentMethod && paymentMethodLabel(cost.paymentMethod),
      ]"
    />
    <p v-if="cost.notes" class="cost-item__notes hb-caption text-medium-emphasis">{{ cost.notes }}</p>

    <template #append>
      <div class="cost-item__amount hb-body-strong hb-numeric">{{ formatCents(cost.amountCents) }}</div>
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-paperclip"
        v-bind="{ onClick: () => emit('receipts', cost), title: t('costs.receipts.title') }"
      >
        {{ receiptCount }}
      </v-btn>
      <ActionsMenu :label="t('common.actionsFor', { name: title })" :actions="actions" />
    </template>
  </ListRow>
</template>

<style scoped>
.cost-item__notes {
  white-space: pre-wrap;
  /* Long links have no break points and would widen the row beyond the window. */
  overflow-wrap: anywhere;
}

.cost-item__amount {
  min-width: 96px;
  text-align: right;
}
</style>
