<script setup lang="ts">
import { computed, onMounted } from 'vue'
import DashboardChart from '../DashboardChart.vue'
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
    <div class="d-flex align-baseline ga-2 mb-2">
      <span class="widget-figure">{{ formatCount(objects.length) }}</span>
      <span class="widget-note">{{ t('dashboard.widgets.purchaseValue', { amount: formatCents(value) }) }}</span>
    </div>

    <EmptyState
      v-if="objects.length === 0"
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
