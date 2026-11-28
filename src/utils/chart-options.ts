import type { EChartsOption } from 'echarts'
import type { ChartType } from '@/types/dashboard'
import type { ChartPoint, ChartSeries } from '@/types/dashboard-statistics'

/** Theme colour names of the chart series, in order (see plugins/vuetify.ts). */
export const DEFAULT_CHART_PALETTE: readonly string[] = ['primary', 'info', 'success', 'warning', 'error', 'secondary']

/** Colours of a chart, taken from the Vuetify theme (see components/dashboard/DashboardChart.vue). */
export interface ChartStyle {
  /** Series colours, in order. */
  palette: readonly string[]
  /** Labels and legend. */
  text: string
  /** Axis lines and grid lines. */
  grid: string
  /** Background of the card: gaps between doughnut slices. */
  surface: string
}

export interface ChartData {
  type: ChartType
  points: readonly ChartPoint[]
  /** Axis labels and tooltips, e.g. a currency. */
  formatValue: (value: number) => string
  /** Bar charts: one colour per bar (doughnuts always have one per slice). */
  colorByPoint?: boolean
  /** The values are counts: axis steps of at least 1, so there are no "0.2 objects". */
  wholeNumbers?: boolean
  /**
   * Bar and line charts: several series over the same periods (e.g. income and
   * costs), with a legend; `points` is ignored then. One colour per series.
   */
  series?: readonly ChartSeries[]
}

function colorAt(palette: readonly string[], index: number): string | undefined {
  return palette[index % palette.length]
}

function doughnutOptions({ points }: ChartData, style: ChartStyle): EChartsOption {
  return {
    legend: { type: 'scroll', orient: 'vertical', right: 0, top: 'middle', textStyle: { color: style.text } },
    series: [
      {
        type: 'pie',
        radius: ['52%', '78%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderRadius: 6, borderColor: style.surface, borderWidth: 2 },
        data: points.map((point) => ({ name: point.label, value: point.value })),
      },
    ],
  }
}

/** One series of a bar or line chart, in colour `index` of the palette. */
function seriesOptions(data: ChartData, style: ChartStyle, points: readonly ChartPoint[], index: number) {
  const color = colorAt(style.palette, index)
  if (data.type === 'line') {
    return {
      type: 'line' as const,
      smooth: true,
      symbolSize: 6,
      lineStyle: { width: 3, color },
      itemStyle: { color },
      areaStyle: { color, opacity: 0.12 },
      data: points.map((point) => point.value),
    }
  }
  return {
    type: 'bar' as const,
    barMaxWidth: 36,
    itemStyle: { borderRadius: [6, 6, 0, 0], color },
    data: points.map((point, position) =>
      data.colorByPoint ? { value: point.value, itemStyle: { color: colorAt(style.palette, position) } } : point.value,
    ),
  }
}

function axisOptions(data: ChartData, style: ChartStyle): EChartsOption {
  const { formatValue, series: several } = data
  const points = several?.[0]?.points ?? data.points
  const series =
    several === undefined
      ? [seriesOptions(data, style, points, 0)]
      : several.map((one, index) => ({ ...seriesOptions(data, style, one.points, index), name: one.label }))
  return {
    ...(several === undefined ? {} : { legend: { top: 0, textStyle: { color: style.text } } }),
    grid: { left: 8, right: 8, top: several === undefined ? 16 : 40, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: points.map((point) => point.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: style.grid } },
      axisLabel: { color: style.text },
    },
    yAxis: {
      type: 'value',
      minInterval: data.wholeNumbers ? 1 : 0,
      axisLabel: { color: style.text, formatter: (value: number) => formatValue(value) },
      splitLine: { lineStyle: { color: style.grid, type: 'dashed' } },
    },
    series,
  }
}

/** The ECharts option of a dashboard chart. */
export function chartOptionsFor(data: ChartData, style: ChartStyle): EChartsOption {
  const options = data.type === 'pie' ? doughnutOptions(data, style) : axisOptions(data, style)
  return {
    color: [...style.palette],
    animationDuration: 400,
    tooltip: {
      trigger: data.type === 'pie' ? 'item' : 'axis',
      valueFormatter: (value) => data.formatValue(Number(value)),
      // Themed, so tooltips stay readable in the dark theme.
      backgroundColor: style.surface,
      borderColor: style.grid,
      textStyle: { color: style.text },
    },
    ...options,
  }
}
