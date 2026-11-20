<script setup lang="ts">
import { computed, onMounted } from 'vue'
import DashboardChart from '../DashboardChart.vue'
import WidgetFigure from '../WidgetFigure.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useInvestments } from '@/composables/useInvestments'
import { t } from '@/i18n'
import type { WidgetSettings, WidgetSize } from '@/types/dashboard'
import { PRIORITY_COLORS, priorityLabel } from '@/types/investment'
import { investmentsPerPriority, type ChartPoint } from '@/types/dashboard-statistics'
import { formatCents } from '@/utils/currency'

/** Total estimated cost of the planned investments, split by priority. */
const props = defineProps<{
  settings: WidgetSettings
  size: WidgetSize
}>()

const { planned, totalEstimatedCostCents, ensureLoaded } = useInvestments()

onMounted(() => {
  void ensureLoaded()
})

/** One bar or slice per priority, in its theme colour. Empty doughnut slices are left out, with their colour. */
const shown = computed<{ points: ChartPoint[]; palette: string[] }>(() => {
  const all = investmentsPerPriority(planned.value).map((total) => ({
    point: {
      key: total.priority,
      label: `${priorityLabel(total.priority)} (${total.count})`,
      value: total.amountCents,
    },
    color: PRIORITY_COLORS[total.priority],
  }))
  const visible = props.settings.chartType === 'pie' ? all.filter(({ point }) => point.value > 0) : all
  return { points: visible.map(({ point }) => point), palette: visible.map(({ color }) => color) }
})
</script>

<template>
  <div>
    <WidgetFigure
      :value="formatCents(totalEstimatedCostCents)"
      :note="t('dashboard.widgets.plannedCount', { count: planned.length })"
    />

    <EmptyState
      v-if="planned.length === 0"
      compact
      icon="mdi-piggy-bank-outline"
      :title="t('dashboard.widgets.noInvestmentsTitle')"
      :text="t('dashboard.widgets.noInvestmentsText')"
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
