<script setup lang="ts">
import { computed, onMounted } from 'vue'
import DashboardChart from '../DashboardChart.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useInvestments } from '@/composables/useInvestments'
import type { WidgetSettings, WidgetSize } from '@/types/dashboard'
import { investmentsPerPriority, type ChartPoint } from '@/types/dashboard-statistics'
import { formatCents } from '@/utils/currency'

/** Total estimated cost of the planned investments, split by priority. */
const props = defineProps<{
  settings: WidgetSettings
  size: WidgetSize
}>()

const { investments, totalEstimatedCostCents, ensureLoaded } = useInvestments()

onMounted(() => {
  void ensureLoaded()
})

const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' } as const

/** One bar or slice per priority, in its theme colour. Empty doughnut slices are left out, with their colour. */
const shown = computed<{ points: ChartPoint[]; palette: string[] }>(() => {
  const all = investmentsPerPriority(investments.value).map((total) => ({
    point: {
      key: total.priority,
      label: `${PRIORITY_LABELS[total.priority]} (${total.count})`,
      value: total.amountCents,
    },
    color: `priority-${total.priority}`,
  }))
  const visible = props.settings.chartType === 'pie' ? all.filter(({ point }) => point.value > 0) : all
  return { points: visible.map(({ point }) => point), palette: visible.map(({ color }) => color) }
})
</script>

<template>
  <div>
    <div class="d-flex align-baseline ga-2 mb-2">
      <span class="widget-figure">{{ formatCents(totalEstimatedCostCents) }}</span>
      <span class="widget-note">{{ investments.length }} planned</span>
    </div>

    <EmptyState
      v-if="investments.length === 0"
      icon="mdi-piggy-bank-outline"
      title="No investments planned"
      text="Investments you plan show up here."
    />
    <DashboardChart
      v-else
      :type="settings.chartType"
      :points="shown.points"
      :palette="shown.palette"
      color-by-point
      :format-value="formatCents"
      :height="size === 'small' ? 200 : 240"
    />
  </div>
</template>

<style scoped>
.widget-figure {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.widget-note {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
