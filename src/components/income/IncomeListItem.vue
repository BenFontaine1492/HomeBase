<script setup lang="ts">
import { computed } from 'vue'
import ActionsMenu from '@/components/common/ActionsMenu.vue'
import ListRow from '@/components/common/ListRow.vue'
import MetaList from '@/components/common/MetaList.vue'
import { t } from '@/i18n'
import { paymentMethodLabel } from '@/types/cost'
import type { Income } from '@/types/income'
import { formatCents } from '@/utils/currency'
import { formatDate } from '@/utils/date'

const props = defineProps<{
  income: Income
  objectName: string | null
  documentCount: number
}>()

const emit = defineEmits<{
  documents: [income: Income]
  edit: [income: Income]
  delete: [income: Income]
}>()

const actions = computed(() => [
  { title: t('income.documents.title'), icon: 'mdi-paperclip', onSelect: () => emit('documents', props.income) },
  { title: t('common.edit'), icon: 'mdi-pencil-outline', onSelect: () => emit('edit', props.income) },
  {
    title: t('common.delete'),
    icon: 'mdi-trash-can-outline',
    danger: true,
    onSelect: () => emit('delete', props.income),
  },
])
</script>

<template>
  <ListRow>
    <template #prepend>
      <v-icon icon="mdi-cash-plus" size="24" class="text-medium-emphasis" />
    </template>
    <div class="hb-body">{{ income.description }}</div>
    <MetaList
      :items="[
        formatDate(income.receivedDate),
        income.category,
        income.payer,
        objectName,
        income.paymentMethod && paymentMethodLabel(income.paymentMethod),
      ]"
    />
    <p v-if="income.notes" class="income-item__notes hb-caption text-medium-emphasis">{{ income.notes }}</p>

    <template #append>
      <div class="income-item__amount hb-body-strong hb-numeric">{{ formatCents(income.amountCents) }}</div>
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-paperclip"
        v-bind="{ onClick: () => emit('documents', income), title: t('income.documents.title') }"
      >
        {{ documentCount }}
      </v-btn>
      <ActionsMenu :label="t('common.actionsFor', { name: income.description })" :actions="actions" />
    </template>
  </ListRow>
</template>

<style scoped>
.income-item__notes {
  white-space: pre-wrap;
  /* Long links have no break points and would widen the row beyond the window. */
  overflow-wrap: anywhere;
}

.income-item__amount {
  min-width: 96px;
  text-align: right;
}
</style>
