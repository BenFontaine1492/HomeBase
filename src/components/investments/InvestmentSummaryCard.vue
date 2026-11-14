<script setup lang="ts">
import { computed } from 'vue'
import type { Investment, InvestmentPriority } from '@/types/investment'
import { INVESTMENT_PRIORITIES } from '@/types/investment'
import { formatCents } from '@/utils/currency'

const props = defineProps<{
  investments: readonly Investment[]
  totalCents: number
}>()

interface PriorityBreakdown {
  priority: InvestmentPriority
  label: string
  cents: number
  share: number
}

const labels: Record<InvestmentPriority, string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
}

const breakdown = computed<PriorityBreakdown[]>(() =>
  INVESTMENT_PRIORITIES.map((priority) => {
    const cents = props.investments
      .filter((investment) => investment.priority === priority)
      .reduce((sum, investment) => sum + investment.estimatedCostCents, 0)
    return {
      priority,
      label: labels[priority],
      cents,
      share: props.totalCents > 0 ? (cents / props.totalCents) * 100 : 0,
    }
  }),
)
</script>

<template>
  <v-card class="summary-card">
    <div class="summary-card__main">
      <div class="summary-card__icon">
        <v-icon icon="mdi-wallet-outline" size="24" color="white" />
      </div>
      <div>
        <div class="summary-card__label">Total planned cost</div>
        <div class="summary-card__total">{{ formatCents(totalCents) }}</div>
        <div class="summary-card__meta">
          {{ investments.length }} planned
          {{ investments.length === 1 ? 'investment' : 'investments' }}
        </div>
      </div>
    </div>

    <div class="summary-card__breakdown">
      <div class="summary-card__bar">
        <div
          v-for="item in breakdown"
          :key="item.priority"
          class="summary-card__bar-segment"
          :class="`bg-priority-${item.priority}`"
          :style="{ width: `${item.share}%` }"
        />
      </div>
      <div class="summary-card__legend">
        <div v-for="item in breakdown" :key="item.priority" class="summary-card__legend-item">
          <span class="summary-card__legend-dot" :class="`bg-priority-${item.priority}`" />
          <span class="summary-card__legend-label">{{ item.label }}</span>
          <span class="summary-card__legend-value">{{ formatCents(item.cents) }}</span>
        </div>
      </div>
    </div>
  </v-card>
</template>

<style scoped>
.summary-card {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(280px, 1.3fr);
  gap: 32px;
  align-items: center;
  padding: 28px 32px;
}

.summary-card__main {
  display: flex;
  align-items: center;
  gap: 20px;
}

.summary-card__icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, #7c5cff 0%, rgb(var(--v-theme-primary)) 100%);
  box-shadow: 0 6px 16px rgba(91, 71, 224, 0.28);
}

.summary-card__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.summary-card__total {
  margin-top: 2px;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.summary-card__meta {
  margin-top: 4px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.summary-card__bar {
  display: flex;
  gap: 3px;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(var(--v-theme-surface-variant));
}

.summary-card__bar-segment {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.summary-card__legend {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.summary-card__legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.8125rem;
}

.summary-card__legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.summary-card__legend-label {
  flex: 1;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.summary-card__legend-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1100px) {
  .summary-card {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
</style>
