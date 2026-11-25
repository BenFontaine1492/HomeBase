<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import type { ChartType } from '@/types/dashboard'
import type { ChartPoint, ChartSeries } from '@/types/dashboard-statistics'
import { DEFAULT_CHART_PALETTE, chartOptionsFor, type ChartStyle } from '@/utils/chart-options'

/*
 * The only place that imports ECharts. Only the parts the dashboard uses are
 * registered, which keeps the bundle small (tree shaking).
 */
use([CanvasRenderer, BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent])

// Props are declared inline: the SFC compiler here can't resolve types imported
// from other files inside defineProps (e.g. `ChartData & { … }`).
const props = withDefaults(
  defineProps<{
    type: ChartType
    /** One series; ignored when `series` is given. */
    points?: readonly ChartPoint[]
    /** Bar and line charts: several series over the same periods, with a legend. */
    series?: readonly ChartSeries[]
    /** Axis labels and tooltips, e.g. a currency. */
    formatValue: (value: number) => string
    /** Bar charts: one colour per bar (doughnuts always have one per slice). */
    colorByPoint?: boolean
    /** The values are counts: whole-number axis steps. */
    wholeNumbers?: boolean
    height?: number
    /** Theme colour names for the series, in order (e.g. the priority colours). */
    palette?: readonly string[]
  }>(),
  // Imported constant: defineProps() is hoisted out of setup(), so it can't use local ones.
  {
    points: () => [],
    colorByPoint: false,
    wholeNumbers: false,
    height: 240,
    palette: () => DEFAULT_CHART_PALETTE,
  },
)

const theme = useTheme()

/** Chart colours from the current Vuetify theme (follows a later dark theme). */
const style = computed<ChartStyle>(() => {
  const { colors } = theme.current.value
  /** A theme colour as '#RRGGBB' (Vuetify normalises the theme to hex strings). */
  const colorOf = (name: string): string | undefined => {
    const color: unknown = colors[name]
    return typeof color === 'string' ? color : undefined
  }
  return {
    palette: props.palette.map(colorOf).filter((color): color is string => color !== undefined),
    text: colorOf('on-surface-variant') ?? '#616161',
    // 8-digit hex: the text colour at 12 % opacity.
    grid: `${colorOf('on-surface') ?? '#000000'}1F`,
    surface: colorOf('surface') ?? '#FFFFFF',
  }
})

const option = computed(() =>
  chartOptionsFor(
    {
      type: props.type,
      points: props.points,
      series: props.series,
      formatValue: props.formatValue,
      colorByPoint: props.colorByPoint,
      wholeNumbers: props.wholeNumbers,
    },
    style.value,
  ),
)
</script>

<template>
  <VChart :option="option" autoresize :style="{ height: `${height}px` }" />
</template>
