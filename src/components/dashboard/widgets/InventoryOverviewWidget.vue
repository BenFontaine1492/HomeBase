<script setup lang="ts">
import { computed, onMounted } from 'vue'
import DashboardChart from '../DashboardChart.vue'
import WidgetFigure from '../WidgetFigure.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { t } from '@/i18n'
import type { WidgetSettings, WidgetSize } from '@/types/dashboard'
import { inventoryValueCents, objectsPerCategory, type ChartPoint } from '@/types/dashboard-statistics'
import { formatCents } from '@/utils/currency'

/** Number of objects per category and their total purchase value. */
defineProps<{
  settings: WidgetSettings
  size: WidgetSize
}>()

const { objects, ensureLoaded: loadObjects } = useHouseholdObjects()
const { categories, ensureLoaded: loadCategories } = useHouseholdCategories()

onMounted(() => {
  void Promise.all([loadObjects(), loadCategories()])
})

const points = computed<ChartPoint[]>(() => objectsPerCategory(objects.value, categories.value))
const value = computed<number>(() => inventoryValueCents(objects.value))

function formatCount(count: number): string {
  return t('common.objectCount', { count })
}
</script>

<template>
  <div>
    <WidgetFigure
      :value="formatCount(objects.length)"
      :note="t('dashboard.widgets.purchaseValue', { amount: formatCents(value) })"
    />

    <EmptyState
      v-if="objects.length === 0"
      compact
      icon="mdi-archive-outline"
      :title="t('dashboard.widgets.inventoryEmptyTitle')"
      :text="t('dashboard.widgets.inventoryEmptyText')"
    />
    <DashboardChart
      v-else
      :type="settings.chartType"
      :points="points"
      color-by-point
      whole-numbers
      :format-value="formatCount"
      :height="size === 'small' ? 200 : 240"
    />
  </div>
</template>
