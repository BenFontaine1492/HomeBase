import { describe, expect, it, vi } from 'vitest'
import type { InvestmentPriority } from '@/types/investment'
import type { RoadmapChartData } from '@/types/project-roadmap'
import {
  balanceOn,
  labelLayout,
  purchasesByDate,
  renderBar,
  savingsOptions,
  targetOf,
  timelineHeight,
  timelineOptions,
  timestampOf,
  type RoadmapChartStyle,
  type RoadmapChartTexts,
} from '@/utils/roadmap-chart'

const style: RoadmapChartStyle = {
  palette: ['#111111', '#222222'],
  text: '#333',
  grid: '#444',
  surface: '#fff',
  strong: '#000',
  priorities: { high: '#h00', medium: '#m00', low: '#l00' },
}
const texts: RoadmapChartTexts = {
  today: 'Today',
  formatCents: (cents) => `${cents / 100} €`,
  formatDate: (date) => `on ${date}`,
  formatMonth: (month) => `M ${month}`,
  affordableFrom: (date) => `from ${date}`,
  priorityLabel: (priority) => `P ${priority}`,
}

const house = { kind: 'project', projectId: 1 } as const
const walls = { kind: 'investment', projectId: 1, investmentId: 7 } as const
const data: RoadmapChartData = {
  today: '2026-11-28',
  balance: [
    { date: '2026-11-28', balanceCents: 0 },
    { date: '2026-12-01', balanceCents: -100 },
    { date: '2026-12-25', balanceCents: 200 },
    { date: '2027-01-25', balanceCents: 500 },
  ],
  curve: [
    { target: house, title: 'House', colorIndex: 0, start: '2026-11-28', end: '2026-12-25', neededCents: 200 },
    { target: house, title: 'Car', colorIndex: 3, start: '2026-12-25', end: '2027-01-25', neededCents: 300 },
  ],
  purchases: [
    {
      target: walls,
      title: 'Walls <1>',
      projectName: 'House',
      priority: 'medium',
      colorIndex: 0,
      date: '2026-12-25',
      neededCents: 200,
    },
  ],
  bars: [
    { target: walls, title: 'Walls <1>', colorIndex: 1, start: '2026-11-28', end: '2026-12-25', neededCents: 200 },
  ],
}

/** The parts of an ECharts option the tests read. */
interface Options {
  legend?: { data: string[] }
  tooltip: { formatter: (params: unknown) => string }
  xAxis: { min: number; max: number; axisLabel: { formatter: (value: number) => string }; splitLine: { show: boolean } }
  yAxis: { data?: string[]; axisLabel: { formatter?: (value: number) => string } }
  series: {
    type: string
    name?: string
    itemStyle?: { color: string }
    lineStyle?: { color: string }
    areaStyle?: { color: { colorStops: { color: string }[] } }
    data: { value: (number | string)[]; target: unknown; tip?: string; itemStyle?: { color: string }; label?: object }[]
  }[]
}

const asOptions = (options: unknown): Options => options as Options

describe('timestampOf / balanceOn', () => {
  it('reads dates in UTC and the balance after a day', () => {
    expect(timestampOf('1970-01-02')).toBe(86_400_000)
    expect(balanceOn(data.balance, '2026-12-24')).toBe(-100)
    expect(balanceOn(data.balance, '2026-12-25')).toBe(200)
    expect(balanceOn(data.balance, '2026-01-01')).toBe(0)
  })
})

describe('targetOf', () => {
  it('reads the target of a chart item', () => {
    expect(targetOf({ data: { target: walls } })).toEqual(walls)
    expect(targetOf({ data: [1, 2] })).toBeNull()
    expect(targetOf({ data: null })).toBeNull()
    expect(targetOf({})).toBeNull()
    expect(targetOf(null)).toBeNull()
  })
})

describe('savingsOptions', () => {
  const options = asOptions(savingsOptions(data, style, texts))

  it('draws one line per project in its colour, from its start to its end', () => {
    const [first, second] = options.series
    expect(first).toMatchObject({ type: 'line', name: 'House', lineStyle: { color: '#111111' } })
    expect(first?.data.map(({ value }) => value)).toEqual([
      [timestampOf('2026-11-28'), 0],
      [timestampOf('2026-12-01'), -100],
      [timestampOf('2026-12-25'), 200],
    ])
    expect(first?.data[0]?.target).toEqual(house)
    expect(second?.lineStyle?.color).toBe('#222222')
    expect(second?.areaStyle?.color.colorStops.map(({ color }) => color)).toEqual(['#22222245', '#22222205'])
    expect(second?.data.map(({ value }) => value[1])).toEqual([200, 500])
    expect(options.legend?.data).toEqual([
      { name: 'House', icon: 'roundRect' },
      { name: 'Car', icon: 'roundRect' },
      { name: 'P high', icon: 'circle' },
      { name: 'P medium', icon: 'circle' },
      { name: 'P low', icon: 'circle' },
    ])
  })

  it('puts each purchase on the curve in the series of its priority, with an escaped tooltip', () => {
    const [high, medium, low] = options.series.slice(2)
    expect([high?.name, medium?.name, low?.name]).toEqual(['P high', 'P medium', 'P low'])
    expect(medium).toMatchObject({ type: 'scatter', itemStyle: { color: '#m00' } })
    expect([high?.data, low?.data]).toEqual([[], []])
    expect(medium?.data[0]).toMatchObject({
      value: [timestampOf('2026-12-25'), 200],
      target: walls,
      label: { formatter: 'Walls <1>' },
    })
    expect(options.tooltip.formatter({ data: medium?.data[0] })).toBe(
      '<b>Walls &lt;1&gt;</b><br>House<br>P medium<br>2 €<br>from 2026-12-25',
    )
    expect(options.tooltip.formatter({ data: options.series[0]?.data[0] })).toBe('')
    expect(options.tooltip.formatter({ data: null })).toBe('')
  })

  it('labels the axes: "Today" first, then months; amounts as money', () => {
    const { xAxis, yAxis } = options
    expect(xAxis.min).toBe(timestampOf('2026-11-28'))
    expect(xAxis.max).toBe(timestampOf('2027-02-25'))
    expect(xAxis.axisLabel.formatter(xAxis.min)).toBe('Today')
    expect(xAxis.axisLabel.formatter(timestampOf('2027-03-01'))).toBe('M 2027-03')
    expect(xAxis.splitLine.show).toBe(false)
    expect(yAxis.axisLabel.formatter?.(12_300)).toBe('123 €')
  })

  it('shows a month after today when there is nothing to draw', () => {
    const empty = asOptions(savingsOptions({ ...data, curve: [], bars: [], purchases: [] }, style, texts))
    expect(empty.xAxis.max).toBe(timestampOf('2026-12-29'))
  })
})

describe('timelineOptions', () => {
  const options = asOptions(timelineOptions(data, style, texts))

  it('draws a bar per span, named on the axis, with grid lines', () => {
    expect(options.yAxis.data).toEqual(['Walls <1>'])
    expect(options.series[0]?.data).toEqual([
      {
        value: [0, timestampOf('2026-11-28'), timestampOf('2026-12-25')],
        target: walls,
        tip: '<b>Walls &lt;1&gt;</b><br>2 €<br>from 2026-12-25',
      },
    ])
    expect(options.xAxis.splitLine.show).toBe(true)
  })

  it('sizes the chart by its bars', () => {
    expect(timelineHeight(1)).toBe(144)
    expect(timelineHeight(4)).toBe(240)
  })
})

describe('renderBar', () => {
  it('draws a rounded bar in its project colour and its end date beside it', () => {
    const api = {
      value: vi.fn((index: number) => [0, 100, 300][index]),
      coord: vi.fn(([x]: number[]) => [x, 50]),
      size: vi.fn(() => [0, 80]),
    }
    const render = renderBar(data.bars, style, texts)
    const shape = render({ dataIndex: 0 } as never, api as never) as {
      children: { shape?: object; style: { fill?: string; text?: string; x?: number } }[]
    }
    const [bar, label] = shape.children
    expect(bar?.shape).toEqual({ x: 100, y: 38, width: 200, height: 24, r: 6 })
    expect(bar?.style.fill).toBe('#222222')
    expect(label?.style).toMatchObject({ text: 'on 2026-12-25', x: 308 })
  })

  it('keeps short bars visible and falls back to 0 for missing coordinates', () => {
    const api = { value: vi.fn(() => 0), coord: vi.fn(() => []), size: vi.fn(() => [0, 20]) }
    const shape = renderBar(data.bars, style, texts)({ dataIndex: 0 } as never, api as never) as {
      children: { shape?: { width: number; height: number; y: number } }[]
    }
    expect(shape.children[0]?.shape).toMatchObject({ width: 6, height: 10, y: -5 })
  })

  it('reads a lane height given as a number, or none', () => {
    const heightFor = (size: unknown): number | undefined => {
      const api = { value: vi.fn(() => 0), coord: vi.fn(() => [0, 0]), size: vi.fn(() => size) }
      const shape = renderBar(data.bars, style, texts)({ dataIndex: 0 } as never, api as never) as {
        children: { shape?: { height: number } }[]
      }
      return shape.children[0]?.shape?.height
    }
    expect(heightFor(30)).toBe(15)
    expect(heightFor([0])).toBe(0)
    const withoutSize = { value: vi.fn(() => 0), coord: vi.fn(() => [0, 0]) }
    const shape = renderBar(data.bars, style, texts)({ dataIndex: 0 } as never, withoutSize as never) as {
      children: { shape?: { height: number } }[]
    }
    expect(shape.children[0]?.shape?.height).toBe(0)
  })
})

describe('purchasesByDate', () => {
  const purchase = (title: string, date: string, priority: InvestmentPriority = 'medium') => ({
    ...data.purchases[0]!,
    title,
    date,
    priority,
  })

  it('puts purchases of the same day into one group, the most important first, in date order', () => {
    const groups = purchasesByDate([
      purchase('B', '2027-02-01', 'low'),
      purchase('A', '2027-01-01'),
      purchase('C', '2027-02-01', 'high'),
    ])
    expect(groups.map((group) => group.map(({ title }) => title))).toEqual([['A'], ['C', 'B']])
  })

  it('draws one point per day, named after its most important purchase', () => {
    const sameDay = { ...data, purchases: [purchase('Walls', '2026-12-25'), purchase('Floor', '2026-12-25', 'high')] }
    const options = asOptions(savingsOptions(sameDay, style, texts))
    const points = options.series[2]?.data
    expect(points).toHaveLength(1)
    expect(points?.[0]).toMatchObject({ label: { formatter: 'Floor +1' } })
    expect(points?.[0]?.tip).toBe(
      '<b>Floor</b><br>House<br>P high<br>2 €<br>from 2026-12-25<br><br><b>Walls</b><br>House<br>P medium<br>2 €<br>from 2026-12-25',
    )
  })
})

describe('labelLayout', () => {
  it('hides overlapping labels and moves labels sticking out on the left into the chart', () => {
    expect(labelLayout({ labelRect: { x: -30 } })).toEqual({ hideOverlap: true, dx: 30 })
    expect(labelLayout({ labelRect: { x: 40 } })).toEqual({ hideOverlap: true, dx: 0 })
  })
})
