<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { CustomChart, LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { t } from '@/i18n'
import { PRIORITY_COLORS, priorityLabel } from '@/types/investment'
import type { RoadmapChartData, RoadmapTarget } from '@/types/project-roadmap'
import { DEFAULT_CHART_PALETTE } from '@/utils/chart-options'
import { withOpacity } from '@/utils/color'
import { formatCents } from '@/utils/currency'
import { formatDate, formatMonth } from '@/utils/date'
import {
  savingsOptions,
  targetOf,
  timelineHeight,
  timelineOptions,
  type RoadmapChartStyle,
  type RoadmapChartTexts,
} from '@/utils/roadmap-chart'

/*
 * The roadmap chart of the Projects pages ("Savings" or "Timeline"); the option
 * builders are in utils/roadmap-chart.ts. Besides components/dashboard/DashboardChart.vue
 * the only place that imports ECharts; only the parts used here are registered.
 */
use([
  CanvasRenderer,
  LineChart,
  ScatterChart,
  CustomChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  LabelLayout,
])

const props = defineProps<{
  data: RoadmapChartData
  mode: 'savings' | 'timeline'
}>()

const emit = defineEmits<{
  /** A project or purchase was clicked. */
  open: [target: RoadmapTarget]
}>()

const theme = useTheme()

/** Chart colours from the current Vuetify theme (follows a later dark theme). */
const style = computed<RoadmapChartStyle>(() => {
  const { colors } = theme.current.value
  /** A theme colour as '#RRGGBB' (Vuetify normalises the theme to hex strings). */
  const colorOf = (name: string): string | undefined => {
    const color: unknown = colors[name]
    return typeof color === 'string' ? color : undefined
  }
  return {
    palette: DEFAULT_CHART_PALETTE.map(colorOf).filter((color): color is string => color !== undefined),
    text: colorOf('on-surface-variant') ?? '#616161',
    strong: colorOf('on-surface') ?? '#000000',
    // The text colour at 12 % opacity (Vuetify's "on-" colours may be 3-digit hex, e.g. '#fff').
    grid: withOpacity(colorOf('on-surface') ?? '#000000', 0.12),
    surface: colorOf('surface') ?? '#FFFFFF',
    priorities: {
      high: colorOf(PRIORITY_COLORS.high) ?? '#C42B1C',
      medium: colorOf(PRIORITY_COLORS.medium) ?? '#9D5D00',
      low: colorOf(PRIORITY_COLORS.low) ?? '#0F7B0F',
    },
  }
})

// A computed, so the texts follow a change of the UI language.
const texts = computed<RoadmapChartTexts>(() => ({
  today: t('projects.roadmap.today'),
  formatCents,
  formatDate,
  formatMonth,
  affordableFrom: (date) => t('projects.roadmap.affordableFrom', { date: formatDate(date) }),
  priorityLabel,
}))

const option = computed(() =>
  props.mode === 'savings'
    ? savingsOptions(props.data, style.value, texts.value)
    : timelineOptions(props.data, style.value, texts.value),
)

const height = computed<number>(() => (props.mode === 'savings' ? 320 : timelineHeight(props.data.bars.length)))

function onClick(params: unknown): void {
  const target = targetOf(params)
  if (target) emit('open', target)
}
</script>

<template>
  <VChart :option="option" autoresize :style="{ height: `${height}px` }" @click="onClick" />
</template>
