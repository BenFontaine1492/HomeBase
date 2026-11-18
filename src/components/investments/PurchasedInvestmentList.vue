<script setup lang="ts">
import { computed } from 'vue'
import InvestmentListItem from './InvestmentListItem.vue'
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
  <v-card class="purchased-list">
    <div class="purchased-list__header">
      <div class="purchased-list__title">{{ t('investments.purchased.title') }}</div>
      <div class="purchased-list__subtitle">
        {{ t('investments.purchased.subtitle', { count: investments.length, total: formatCents(totalCents) }) }}
      </div>
    </div>
    <v-divider />
    <template v-for="(investment, index) in investments" :key="investment.id">
      <v-divider v-if="index > 0" />
      <InvestmentListItem
        :investment="investment"
        :rank="null"
        @edit="emit('edit', $event)"
        @delete="emit('delete', $event)"
        @plan="emit('plan', $event)"
        @to-inventory="emit('toInventory', $event)"
      />
    </template>
  </v-card>
</template>

<style scoped>
.purchased-list__header {
  padding: 20px 24px;
}

.purchased-list__title {
  font-size: 1rem;
  font-weight: 600;
}

.purchased-list__subtitle {
  margin-top: 2px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
