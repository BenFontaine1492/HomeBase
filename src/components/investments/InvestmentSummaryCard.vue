<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import { INVESTMENT_PRIORITIES, PRIORITY_COLORS, type Investment, type InvestmentPriority } from '@/types/investment'
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

const breakdown = computed<PriorityBreakdown[]>(() =>
  INVESTMENT_PRIORITIES.map((priority) => {
    const cents = props.investments
      .filter((investment) => investment.priority === priority)
      .reduce((sum, investment) => sum + investment.estimatedCostCents, 0)
    return {
      priority,
      label: t(`investments.summary.priorities.${priority}`),
      cents,
      share: props.totalCents > 0 ? (cents / props.totalCents) * 100 : 0,
    }
  }),
)
</script>

<template>
  <v-card class="summary-card">
    <div>
      <div class="hb-caption text-medium-emphasis">{{ t('investments.summary.total') }}</div>
      <div class="hb-title hb-numeric">{{ formatCents(totalCents) }}</div>
      <div class="hb-caption text-medium-emphasis">
        {{ t('investments.summary.count', { count: investments.length }) }}
      </div>
    </div>

    <div>
      <div class="summary-card__bar">
        <div
          v-for="item in breakdown"
          :key="item.priority"
          class="summary-card__bar-segment"
          :class="`bg-${PRIORITY_COLORS[item.priority]}`"
          :style="{ width: `${item.share}%` }"
        />
      </div>
      <div class="summary-card__legend">
        <div v-for="item in breakdown" :key="item.priority" class="summary-card__legend-item">
          <span class="summary-card__legend-dot" :class="`bg-${PRIORITY_COLORS[item.priority]}`" />
          <span class="summary-card__legend-label hb-caption text-medium-emphasis">{{ item.label }}</span>
          <span class="hb-body-strong hb-numeric">{{ formatCents(item.cents) }}</span>
        </div>
      </div>
    </div>
  </v-card>
</template>

<style scoped>
.summary-card {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) minmax(280px, 1.3fr);
  gap: 32px;
  align-items: center;
  padding: 24px;
}

.summary-card__bar {
  display: flex;
  gap: 4px;
  height: 8px;
  overflow: hidden;
  border-radius: 4px;
  background: rgb(var(--v-theme-surface-variant));
}

.summary-card__bar-segment {
  height: 100%;
  border-radius: 4px;
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
  gap: 8px;
}

.summary-card__legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.summary-card__legend-label {
  flex: 1;
}

@media (max-width: 1100px) {
  .summary-card {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
</style>
