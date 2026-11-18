import { describe, expect, it } from 'vitest'
import { chartOptionsFor, type ChartData, type ChartStyle } from '@/utils/chart-options'

const style: ChartStyle = { palette: ['#111', '#222'], text: '#333', grid: '#444', surface: '#fff' }
const points = [
  { key: 'a', label: 'A', value: 100 },
  { key: 'b', label: 'B', value: 250 },
  { key: 'c', label: 'C', value: 50 },
]
const data: ChartData = { type: 'bar', points, formatValue: (value) => `${value} €` }

type SeriesItem = number | { name?: string; value: number; itemStyle?: { color: string } }

/** The parts of an ECharts option the tests read. */
interface Options {
  color: string[]
  tooltip: { trigger: string; valueFormatter: (value: number) => string }
  xAxis?: { data: string[] }
  yAxis: { axisLabel: { formatter: (value: number) => string } }
  series: { type: string; smooth?: boolean; data: SeriesItem[] }[]
}

function optionsOf(chart: Partial<ChartData>): Options {
  return chartOptionsFor({ ...data, ...chart }, style) as unknown as Options
}

describe('chartOptionsFor', () => {
  it('builds a bar chart with formatted values', () => {
    const options = optionsOf({})
    expect(options.color).toEqual(['#111', '#222'])
    expect(options.tooltip.trigger).toBe('axis')
    expect(options.tooltip.valueFormatter(250)).toBe('250 €')
    expect(options.xAxis?.data).toEqual(['A', 'B', 'C'])
    expect(options.yAxis.axisLabel.formatter(100)).toBe('100 €')
    expect(options.series[0]).toMatchObject({ type: 'bar', data: [100, 250, 50] })
  })

  it('colours bars one by one when asked, cycling through the palette', () => {
    const [series] = optionsOf({ colorByPoint: true }).series
    const colors = series!.data.map((item) => (typeof item === 'number' ? null : item.itemStyle?.color))
    expect(colors).toEqual(['#111', '#222', '#111'])
  })

  it('builds a line chart', () => {
    const [series] = optionsOf({ type: 'line' }).series
    expect(series).toMatchObject({ type: 'line', smooth: true, data: [100, 250, 50] })
  })

  it('builds a doughnut with named slices', () => {
    const options = optionsOf({ type: 'pie' })
    expect(options.tooltip.trigger).toBe('item')
    expect(options.xAxis).toBeUndefined()
    expect(options.series[0]?.type).toBe('pie')
    expect(options.series[0]?.data).toEqual([
      { name: 'A', value: 100 },
      { name: 'B', value: 250 },
      { name: 'C', value: 50 },
    ])
  })
})
