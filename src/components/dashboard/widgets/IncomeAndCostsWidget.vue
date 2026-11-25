<script setup lang="ts">
import { computed, onMounted } from 'vue'
import DashboardChart from '../DashboardChart.vue'
import WidgetFigure from '../WidgetFigure.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useCosts } from '@/composables/useCosts'
import { useIncome } from '@/composables/useIncome'
import { t } from '@/i18n'
import { timeRangeLabel, type WidgetSettings, type WidgetSize } from '@/types/dashboard'
import { incomeAndCostsOverTime, pointOfIncome, sumOf, type ChartSeries } from '@/types/dashboard-statistics'
import { formatCents } from '@/utils/currency'
import { formatMonth, todayIsoDate } from '@/utils/date'

/** Income and costs side by side per month or year, and the balance of the time range. */
const props = defineProps<{
  settings: WidgetSettings
  size: WidgetSize
}>()

const { costs, ensureLoaded: loadCosts } = useCosts()
const { income, ensureLoaded: loadIncome } = useIncome()

onMounted(() => {
  void Promise.all([loadCosts(), loadIncome()])
})

/** Income first (green), then the costs (red). */
const PALETTE = ['success', 'error']

const series = computed<ChartSeries[]>(() =>
  incomeAndCostsOverTime(
    { income: income.value.map(pointOfIncome), costs: costs.value },
    props.settings.timeRange,
    todayIsoDate(),
    formatMonth,
  ),
)

const incomeTotal = computed<number>(() => sumOf(series.value[0]?.points ?? []))
const costsTotal = computed<number>(() => sumOf(series.value[1]?.points ?? []))
const balance = computed<number>(() => incomeTotal.value - costsTotal.value)

const caption = computed<string>(() =>
  t('dashboard.widgets.balanceNote', {
    range: timeRangeLabel(props.settings.timeRange),
    income: formatCents(incomeTotal.value),
    costs: formatCents(costsTotal.value),
  }),
)
</script>

<template>
  <div>
    <WidgetFigure :value="formatCents(balance)" :note="caption" />

    <EmptyState
      v-if="incomeTotal === 0 && costsTotal === 0"
      compact
      icon="mdi-scale-balance"
      :title="t('dashboard.widgets.noIncomeAndCostsTitle')"
      :text="t('dashboard.widgets.noIncomeAndCostsText')"
    />
    <DashboardChart
      v-else
      :type="settings.chartType"
      :series="series"
      :format-value="formatCents"
      :palette="PALETTE"
      :height="size === 'small' ? 200 : 260"
    />
  </div>
</template>
