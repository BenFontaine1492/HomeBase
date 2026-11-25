<script setup lang="ts">
import { computed, onMounted } from 'vue'
import DashboardChart from '../DashboardChart.vue'
import WidgetFigure from '../WidgetFigure.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { useIncome } from '@/composables/useIncome'
import { t } from '@/i18n'
import { timeRangeLabel, type WidgetSettings, type WidgetSize } from '@/types/dashboard'
import {
  costsByGroup,
  costsOverTime,
  isFiltered,
  pointOfIncome,
  resolveFilter,
  sumOf,
  type ChartPoint,
} from '@/types/dashboard-statistics'
import { formatCents } from '@/utils/currency'
import { formatMonth, todayIsoDate } from '@/utils/date'

/** Recorded income (all, or of one category): over time (bar/line) or split up (doughnut). */
const props = defineProps<{
  settings: WidgetSettings
  size: WidgetSize
}>()

const { objects, ensureLoaded: loadObjects } = useHouseholdObjects()
const { categories, ensureLoaded: loadCategories } = useHouseholdCategories()
const { income, ensureLoaded: loadIncome } = useIncome()

onMounted(() => {
  void Promise.all([loadObjects(), loadCategories(), loadIncome()])
})

const resolved = computed(() => resolveFilter(props.settings, categories.value, objects.value))

const points = computed<ChartPoint[]>(() => {
  const settings = {
    ...resolved.value.filter,
    timeRange: props.settings.timeRange,
    costCategory: props.settings.costCategory,
  }
  // Income has the shape of a cost here, so the cost statistics work for it too.
  const data = { costs: income.value.map(pointOfIncome), objects: objects.value }
  const today = todayIsoDate()
  if (props.settings.chartType === 'pie') return costsByGroup(data, settings, today)
  return costsOverTime(data, settings, today, formatMonth)
})

const total = computed<number>(() => sumOf(points.value))

const caption = computed<string>(() => {
  const parts = [timeRangeLabel(props.settings.timeRange)]
  if (props.settings.costCategory !== null) parts.push(props.settings.costCategory)
  if (props.settings.chartType === 'pie') {
    parts.push(
      isFiltered(resolved.value.filter) ? t('dashboard.widgets.perObject') : t('dashboard.widgets.perCategory'),
    )
  }
  return parts.join(', ')
})
</script>

<template>
  <div>
    <p v-if="resolved.stale" class="hb-caption text-medium-emphasis mb-2">{{ t('dashboard.widgets.staleFilter') }}</p>

    <WidgetFigure :value="formatCents(total)" :note="caption" />

    <EmptyState
      v-if="total === 0"
      compact
      icon="mdi-cash-plus"
      :title="t('dashboard.widgets.noIncomeTitle')"
      :text="t('dashboard.widgets.noIncomeText')"
    />
    <DashboardChart
      v-else
      :type="settings.chartType"
      :points="points"
      :format-value="formatCents"
      :height="size === 'small' ? 200 : 260"
    />
  </div>
</template>
