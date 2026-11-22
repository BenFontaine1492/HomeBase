<script setup lang="ts">
import { computed, onMounted } from 'vue'
import DashboardChart from '../DashboardChart.vue'
import WidgetFigure from '../WidgetFigure.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useCosts } from '@/composables/useCosts'
import { useTaxCategories } from '@/composables/useTaxCategories'
import { t } from '@/i18n'
import { timeRangeLabel, type WidgetSettings, type WidgetSize } from '@/types/dashboard'
import { costsByTaxCategory, sumOf, type ChartPoint } from '@/types/dashboard-statistics'
import { formatCents } from '@/utils/currency'
import { todayIsoDate } from '@/utils/date'

/** Costs with a tax category in the time range (this year by default), per category. */
const props = defineProps<{
  settings: WidgetSettings
  size: WidgetSize
}>()

const { costs, ensureLoaded: loadCosts } = useCosts()
const { categories } = useTaxCategories()

onMounted(() => {
  void loadCosts()
})

const points = computed<ChartPoint[]>(() =>
  costsByTaxCategory(costs.value, categories.value, props.settings.timeRange, todayIsoDate()),
)
const total = computed<number>(() => sumOf(points.value))
</script>

<template>
  <div>
    <WidgetFigure :value="formatCents(total)" :note="timeRangeLabel(settings.timeRange)" />

    <EmptyState
      v-if="total === 0"
      compact
      icon="mdi-file-document-remove-outline"
      :title="t('dashboard.widgets.noTaxCostsTitle')"
      :text="t('dashboard.widgets.noTaxCostsText')"
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
