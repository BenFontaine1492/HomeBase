import type { CustomSeriesRenderItem, EChartsOption } from 'echarts'
import { INVESTMENT_PRIORITIES, type InvestmentPriority } from '@/types/investment'
import type {
  BalancePoint,
  RoadmapChartData,
  RoadmapPurchase,
  RoadmapSpan,
  RoadmapTarget,
} from '@/types/project-roadmap'
import type { ChartStyle } from './chart-options'
import { escapeHtml } from './text'

/*
 * The ECharts options of the roadmap charts of the Projects pages (drawn by
 * components/projects/RoadmapChart.vue): "Savings" = the projected balance, coloured
 * by the project being saved for, with a point per purchase day; "Timeline" = one bar
 * per project or purchase. Dates are 'YYYY-MM-DD', drawn on a time axis in UTC.
 */

const DAY_MS = 86_400_000

/** Colours of a roadmap chart, taken from the Vuetify theme. */
export interface RoadmapChartStyle extends ChartStyle {
  /** Labels next to bars and points. */
  strong: string
  /** The purchase points, by priority. */
  priorities: Readonly<Record<InvestmentPriority, string>>
}

/** Texts and formats of a roadmap chart, in the UI language. */
export interface RoadmapChartTexts {
  /** The first axis label. */
  today: string
  formatCents: (cents: number) => string
  formatDate: (isoDate: string) => string
  /** 'YYYY-MM' → e.g. "Mar 2027". */
  formatMonth: (isoMonth: string) => string
  /** Tooltip line of a purchase or bar, e.g. "Affordable from 25 Mar 2027". */
  affordableFrom: (isoDate: string) => string
  priorityLabel: (priority: InvestmentPriority) => string
}

/** One item of a chart series: what a click opens and its tooltip. */
interface TargetItem {
  value: (number | string)[]
  target: RoadmapTarget
  tip: string
}

export function timestampOf(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`)
}

function isoDateOf(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

/** The balance after the payments of `date` (0 before the first point). */
export function balanceOn(balance: readonly BalancePoint[], date: string): number {
  return balance.reduce((cents, point) => (point.date <= date ? point.balanceCents : cents), 0)
}

function colorOf(style: RoadmapChartStyle, colorIndex: number): string | undefined {
  return style.palette[colorIndex % style.palette.length]
}

/** The tooltip of a span or purchase: its title in bold, then the lines (texts are escaped). */
function tipOf(title: string, lines: readonly string[]): string {
  return [`<b>${escapeHtml(title)}</b>`, ...lines.map(escapeHtml)].join('<br>')
}

/** The data of the chart item of an event or tooltip (`params.data`); empty for anything else. */
function itemOf(params: unknown): Partial<TargetItem> {
  const data = typeof params === 'object' && params !== null && 'data' in params ? params.data : undefined
  return typeof data === 'object' && data !== null ? data : {}
}

/** Where a click on a chart item leads; null for anything else. */
export function targetOf(params: unknown): RoadmapTarget | null {
  return itemOf(params).target ?? null
}

/** The time axis from today to about a month after the last date. */
function timeAxis(data: RoadmapChartData, style: RoadmapChartStyle, texts: RoadmapChartTexts, gridLines: boolean) {
  const ends = [...data.curve, ...data.bars].map((span) => timestampOf(span.end))
  const min = timestampOf(data.today)
  return {
    type: 'time' as const,
    min,
    max: Math.max(min, ...ends) + 31 * DAY_MS,
    splitNumber: 6,
    axisLabel: {
      color: style.text,
      hideOverlap: true,
      showMinLabel: true,
      formatter: (value: number) => (value === min ? texts.today : texts.formatMonth(isoDateOf(value).slice(0, 7))),
    },
    axisLine: { lineStyle: { color: style.grid } },
    axisTick: { show: false },
    splitLine: { show: gridLines, lineStyle: { color: style.grid } },
  }
}

function tooltip(style: RoadmapChartStyle) {
  return {
    trigger: 'item' as const,
    backgroundColor: style.surface,
    borderColor: style.grid,
    textStyle: { color: style.strong },
    formatter: (params: unknown) => itemOf(params).tip ?? '',
  }
}

/** One line of the savings curve: the balance from the start to the end of `span`, in its project's colour. */
function curveSeries(span: RoadmapSpan, balance: readonly BalancePoint[], style: RoadmapChartStyle) {
  const color = colorOf(style, span.colorIndex)
  const inside = balance.filter((point) => point.date > span.start && point.date <= span.end)
  const points = [{ date: span.start, balanceCents: balanceOn(balance, span.start) }, ...inside]
  return {
    type: 'line' as const,
    name: span.title,
    step: 'end' as const,
    symbol: 'none',
    triggerLineEvent: true,
    z: 2,
    lineStyle: { color, width: 2.5 },
    itemStyle: { color },
    areaStyle: {
      color: {
        type: 'linear' as const,
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: `${color}45` },
          { offset: 1, color: `${color}05` },
        ],
      },
    },
    data: points.map((point) => ({ value: [timestampOf(point.date), point.balanceCents], target: span.target })),
  }
}

/** A purchase list is never empty when grouped, so the first one always exists. */
type PurchaseGroup = [RoadmapPurchase, ...RoadmapPurchase[]]

function byPriority(a: RoadmapPurchase, b: RoadmapPurchase): number {
  return INVESTMENT_PRIORITIES.indexOf(a.priority) - INVESTMENT_PRIORITIES.indexOf(b.priority)
}

/**
 * The purchases grouped by the day they become affordable (one point per day), in date
 * order; within a day the most important one first.
 */
export function purchasesByDate(purchases: readonly RoadmapPurchase[]): PurchaseGroup[] {
  const groups = new Map<string, PurchaseGroup>()
  for (const purchase of purchases) {
    const group = groups.get(purchase.date)
    if (group) group.push(purchase)
    else groups.set(purchase.date, [purchase])
  }
  // Fresh arrays (the spread, the groups); toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  for (const group of groups.values()) group.sort(byPriority)
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...groups.values()].sort((a, b) => a[0].date.localeCompare(b[0].date))
}

/**
 * Labels sit above their point. One that would overlap another is hidden (its point and
 * tooltip stay); one that would stick out on the left is moved into the chart.
 */
export function labelLayout(params: { labelRect: { x: number } }) {
  return { hideOverlap: true, dx: Math.max(0, -params.labelRect.x) }
}

/** One point of the savings curve: the purchases of a day, named after the most important one. */
function purchasePoint(group: PurchaseGroup, data: RoadmapChartData, texts: RoadmapChartTexts) {
  const [first] = group
  const { date } = first
  const lines = (purchase: RoadmapPurchase) => [
    purchase.projectName,
    texts.priorityLabel(purchase.priority),
    texts.formatCents(purchase.neededCents),
    texts.affordableFrom(date),
  ]
  return {
    value: [timestampOf(date), balanceOn(data.balance, date)],
    // A click opens the most important one; the tooltip lists them all.
    target: first.target,
    tip: group.map((purchase) => tipOf(purchase.title, lines(purchase))).join('<br><br>'),
    label: { formatter: group.length > 1 ? `${first.title} +${group.length - 1}` : first.title },
  }
}

/** The purchase points, one series per priority (coloured by it, in the legend), placed by their most important purchase. */
function purchaseSeries(data: RoadmapChartData, style: RoadmapChartStyle, texts: RoadmapChartTexts) {
  const groups = purchasesByDate(data.purchases)
  return INVESTMENT_PRIORITIES.map((priority) => ({
    type: 'scatter' as const,
    name: texts.priorityLabel(priority),
    symbol: 'circle',
    symbolSize: 12,
    z: 5,
    itemStyle: { color: style.priorities[priority], borderColor: style.surface, borderWidth: 2 },
    label: {
      show: true,
      position: 'top' as const,
      distance: 6,
      color: style.strong,
      // A halo in the card colour keeps the text readable on the curve.
      textBorderColor: style.surface,
      textBorderWidth: 3,
    },
    labelLayout,
    data: groups.filter((group) => group[0].priority === priority).map((group) => purchasePoint(group, data, texts)),
  }))
}

/** "Savings": the projected balance, coloured by project, with a point (coloured by priority) where purchases become affordable. */
export function savingsOptions(
  data: RoadmapChartData,
  style: RoadmapChartStyle,
  texts: RoadmapChartTexts,
): EChartsOption {
  return {
    animationDuration: 400,
    legend: {
      data: [
        ...data.curve.map((span) => ({ name: span.title, icon: 'roundRect' })),
        ...INVESTMENT_PRIORITIES.map((priority) => ({ name: texts.priorityLabel(priority), icon: 'circle' })),
      ],
      top: 0,
      left: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: style.strong },
    },
    grid: { left: 8, right: 24, top: 56, bottom: 8 },
    tooltip: tooltip(style),
    xAxis: timeAxis(data, style, texts, false),
    yAxis: {
      type: 'value',
      axisLabel: { color: style.text, formatter: (cents: number) => texts.formatCents(cents) },
      splitLine: { lineStyle: { color: style.grid } },
    },
    series: [
      ...data.curve.map((span) => curveSeries(span, data.balance, style)),
      ...purchaseSeries(data, style, texts),
    ],
  }
}

/** Draws one timeline bar (from the start to the end of its span) and its end date next to it. */
export function renderBar(
  bars: readonly RoadmapSpan[],
  style: RoadmapChartStyle,
  texts: RoadmapChartTexts,
): CustomSeriesRenderItem {
  return (params, api) => {
    const bar = bars[params.dataIndex]!
    const lane = api.value(0)
    const [startX = 0, centerY = 0] = api.coord([api.value(1), lane])
    const [endX = 0] = api.coord([api.value(2), lane])
    // The height of a lane (size() gives [width, height] for a value pair).
    const size = api.size?.([0, 1]) ?? 0
    const laneHeight = Array.isArray(size) ? (size[1] ?? 0) : size
    const height = Math.min(24, laneHeight * 0.5)
    return {
      type: 'group',
      children: [
        {
          type: 'rect',
          shape: { x: startX, y: centerY - height / 2, width: Math.max(endX - startX, 6), height, r: 6 },
          style: { fill: colorOf(style, bar.colorIndex) },
        },
        {
          type: 'text',
          style: {
            text: texts.formatDate(bar.end),
            x: endX + 8,
            y: centerY,
            fill: style.strong,
            fontWeight: 600,
            verticalAlign: 'middle',
          },
        },
      ],
    }
  }
}

/** "Timeline": one bar per span, from when saving for it starts until it is affordable. */
export function timelineOptions(
  data: RoadmapChartData,
  style: RoadmapChartStyle,
  texts: RoadmapChartTexts,
): EChartsOption {
  const items: TargetItem[] = data.bars.map((bar, index) => ({
    value: [index, timestampOf(bar.start), timestampOf(bar.end)],
    target: bar.target,
    tip: tipOf(bar.title, [texts.formatCents(bar.neededCents), texts.affordableFrom(bar.end)]),
  }))
  return {
    animationDuration: 400,
    // Room on the right for the date next to the last bar, however long the timeline is.
    grid: { left: 8, right: 112, top: 8, bottom: 8 },
    tooltip: tooltip(style),
    xAxis: timeAxis(data, style, texts, true),
    yAxis: {
      type: 'category',
      data: data.bars.map((bar) => bar.title),
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: style.strong, fontWeight: 600, margin: 16, width: 160, overflow: 'truncate' },
    },
    series: [
      {
        type: 'custom',
        renderItem: renderBar(data.bars, style, texts),
        encode: { x: [1, 2], y: 0 },
        data: items,
      },
    ],
  }
}

/** The height of a timeline for `count` bars, so each bar has room. */
export function timelineHeight(count: number): number {
  return Math.max(count, 2) * 48 + 48
}
