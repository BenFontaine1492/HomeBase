<script setup lang="ts">
import { computed, onMounted } from 'vue'
import DashboardChart from '../DashboardChart.vue'
import WidgetFigure from '../WidgetFigure.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { useMaintenance } from '@/composables/useMaintenance'
import { t } from '@/i18n'
import { timeRangeLabel, type WidgetSettings, type WidgetSize } from '@/types/dashboard'
import {
  isFiltered,
  maintenanceCostsByGroup,
  maintenanceCostsOverTime,
  resolveFilter,
  sumOf,
  type ChartPoint,
} from '@/types/dashboard-statistics'
import { formatCents } from '@/utils/currency'
import { formatMonth, todayIsoDate } from '@/utils/date'

/** Recorded maintenance costs: over time (bar/line) or split up (doughnut). */
const props = defineProps<{
  settings: WidgetSettings
  size: WidgetSize
}>()

const { objects, ensureLoaded: loadObjects } = useHouseholdObjects()
const { categories, ensureLoaded: loadCategories } = useHouseholdCategories()
const { records, ensureLoaded: loadMaintenance } = useMaintenance()

onMounted(() => {
  void Promise.all([loadObjects(), loadCategories(), loadMaintenance()])
})

const resolved = computed(() => resolveFilter(props.settings, categories.value, objects.value))

const points = computed<ChartPoint[]>(() => {
  const settings = { ...resolved.value.filter, timeRange: props.settings.timeRange }
  const today = todayIsoDate()
  if (props.settings.chartType === 'pie') {
    const data = { records: records.value, objects: objects.value, categories: categories.value }
    return maintenanceCostsByGroup(data, settings, today)
  }
  return maintenanceCostsOverTime({ records: records.value, objects: objects.value }, settings, today, formatMonth)
})

const total = computed<number>(() => sumOf(points.value))

const caption = computed<string>(() => {
  const split = isFiltered(resolved.value.filter)
    ? t('dashboard.widgets.perObject')
    : t('dashboard.widgets.perCategory')
  const range = timeRangeLabel(props.settings.timeRange)
  return props.settings.chartType === 'pie' ? `${range}, ${split}` : range
})
</script>

<template>
  <div>
    <p v-if="resolved.stale" class="hb-caption text-medium-emphasis mb-2">{{ t('dashboard.widgets.staleFilter') }}</p>

    <WidgetFigure :value="formatCents(total)" :note="caption" />

    <EmptyState
      v-if="total === 0"
      compact
      icon="mdi-cash-remove"
      :title="t('dashboard.widgets.noCostsTitle')"
      :text="t('dashboard.widgets.noCostsText')"
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
