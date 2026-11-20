<script setup lang="ts">
import { computed } from 'vue'
import InvestmentListItem from './InvestmentListItem.vue'
import ListSection from '@/components/common/ListSection.vue'
import { t } from '@/i18n'
import type { Investment } from '@/types/investment'
import { formatCents } from '@/utils/currency'

/** Investments already bought, newest purchase first. */
const props = defineProps<{
  investments: readonly Investment[]
}>()

const emit = defineEmits<{
  edit: [investment: Investment]
  delete: [investment: Investment]
  plan: [investment: Investment]
  toInventory: [investment: Investment]
}>()

const totalCents = computed<number>(() =>
  props.investments.reduce((sum, investment) => sum + investment.estimatedCostCents, 0),
)
</script>

<template>
  <ListSection
    :title="t('investments.purchased.title')"
    :subtitle="t('investments.purchased.subtitle', { count: investments.length, total: formatCents(totalCents) })"
  >
    <InvestmentListItem
      v-for="investment in investments"
      :key="investment.id"
      :investment="investment"
      :rank="null"
      @edit="emit('edit', $event)"
      @delete="emit('delete', $event)"
      @plan="emit('plan', $event)"
      @to-inventory="emit('toInventory', $event)"
    />
  </ListSection>
</template>
