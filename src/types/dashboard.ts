import { t } from '@/i18n'
import type { Messages } from '@/i18n/messages/en'
import { COST_TYPES, type CostType } from './cost'
import { normaliseText } from '@/utils/text'

/*
 * The dashboard: an ordered list of widgets (table `dashboard_widgets`, migration 0007).
 * WIDGET_TYPES is the registry of widget types the app knows; a later feature adds
 * its widget here and its component in components/dashboard/widget-registry.ts.
 */

export type WidgetSize = 'small' | 'medium' | 'large'
export const WIDGET_SIZES: readonly WidgetSize[] = ['small', 'medium', 'large']
export function widgetSizeLabel(size: WidgetSize): string {
  return t(`dashboard.sizes.${size}`)
}

export type ChartType = 'bar' | 'line' | 'pie'
export function chartTypeLabel(chartType: ChartType): string {
  return t(`dashboard.chartTypes.${chartType}`)
}

export type TimeRange = 'last-12-months' | 'this-year' | 'last-5-years' | 'all'
export const TIME_RANGES: readonly TimeRange[] = ['last-12-months', 'this-year', 'last-5-years', 'all']
export function timeRangeLabel(range: TimeRange): string {
  return t(`dashboard.timeRanges.${range}`)
}

/** Category filter: a category id, 'none' = objects without a category, null = all. */
export type CategoryFilter = number | 'none' | null

/** The settings of a widget, complete (defaults filled in). Unsupported ones keep their default. */
export interface WidgetSettings {
  chartType: ChartType
  timeRange: TimeRange
  categoryId: CategoryFilter
  /** An object id; null = all. Narrower than the category filter. */
  objectId: number | null
  /** Only costs of this type; null = all. */
  costType: CostType | null
}

/** Which settings a widget type offers. */
export interface WidgetSupport {
  /** The chart types to choose from; empty = no chart. */
  chartTypes: readonly ChartType[]
  timeRange: boolean
  /** 'category' = by category, 'object' = by category or object, null = no filter. */
  filter: 'category' | 'object' | null
  /** Whether it can show only one cost type. */
  costType: boolean
}

/** Ids of the widget types; each has a title and description in the messages (`dashboard.widgetTypes`). */
export type WidgetTypeId = keyof Messages['dashboard']['widgetTypes']

export interface WidgetTypeDefinition {
  id: WidgetTypeId
  icon: string
  defaultSize: WidgetSize
  supports: WidgetSupport
  defaults: WidgetSettings
}

const BASE_SETTINGS: WidgetSettings = {
  chartType: 'bar',
  timeRange: 'last-12-months',
  categoryId: null,
  objectId: null,
  costType: null,
}

export const WIDGET_TYPES: readonly WidgetTypeDefinition[] = [
  {
    id: 'upcoming-maintenance',
    icon: 'mdi-wrench-clock',
    defaultSize: 'medium',
    supports: { chartTypes: [], timeRange: false, filter: 'object', costType: false },
    defaults: BASE_SETTINGS,
  },
  {
    id: 'costs',
    icon: 'mdi-cash-multiple',
    defaultSize: 'large',
    supports: { chartTypes: ['bar', 'line', 'pie'], timeRange: true, filter: 'object', costType: true },
    defaults: { ...BASE_SETTINGS, timeRange: 'last-5-years' },
  },
  {
    id: 'tax-categories',
    icon: 'mdi-file-document-multiple-outline',
    defaultSize: 'medium',
    supports: { chartTypes: ['pie', 'bar'], timeRange: true, filter: null, costType: false },
    defaults: { ...BASE_SETTINGS, chartType: 'pie', timeRange: 'this-year' },
  },
  {
    id: 'recent-objects',
    icon: 'mdi-history',
    defaultSize: 'medium',
    supports: { chartTypes: [], timeRange: false, filter: 'category', costType: false },
    defaults: BASE_SETTINGS,
  },
  {
    id: 'planned-investments',
    icon: 'mdi-piggy-bank-outline',
    defaultSize: 'small',
    supports: { chartTypes: ['bar', 'pie'], timeRange: false, filter: null, costType: false },
    defaults: { ...BASE_SETTINGS, chartType: 'pie' },
  },
  {
    id: 'inventory-overview',
    icon: 'mdi-archive-outline',
    defaultSize: 'medium',
    supports: { chartTypes: ['bar', 'pie'], timeRange: false, filter: null, costType: false },
    defaults: BASE_SETTINGS,
  },
]

export function findWidgetType(id: string): WidgetTypeDefinition | undefined {
  return WIDGET_TYPES.find((type) => type.id === id)
}

/** The default title of a widget type, e.g. "Upcoming maintenance". */
export function widgetTypeTitle(type: WidgetTypeDefinition): string {
  return t(`dashboard.widgetTypes.${type.id}.title`)
}

/** What a widget type shows (the add dialog). */
export function widgetTypeDescription(type: WidgetTypeDefinition): string {
  return t(`dashboard.widgetTypes.${type.id}.description`)
}

/** A widget as stored. `type` may be unknown to this version (see `findWidgetType`). */
export interface DashboardWidget {
  id: number
  type: string
  position: number
  size: WidgetSize
  /** null = the type's default title. */
  title: string | null
  settings: WidgetSettings
}

/** The title shown for a widget. */
export function widgetTitle(widget: Pick<DashboardWidget, 'type' | 'title'>): string {
  if (widget.title !== null) return widget.title
  const type = findWidgetType(widget.type)
  return type ? widgetTypeTitle(type) : t('dashboard.unknownWidget')
}

/** Fields of a widget to save; the position is its index in the layout. */
export interface DashboardWidgetInput {
  type: string
  size: WidgetSize
  title?: string | null
  settings?: Partial<WidgetSettings>
}

/**
 * The layout of a new installation and of "Reset to default". Migration 0007 seeds a
 * copy (with the old type id 'maintenance-costs', renamed to 'costs' by 0010).
 */
export const DEFAULT_DASHBOARD: readonly DashboardWidgetInput[] = [
  { type: 'upcoming-maintenance', size: 'medium' },
  { type: 'recent-objects', size: 'medium' },
  { type: 'costs', size: 'large', settings: { chartType: 'bar', timeRange: 'last-5-years' } },
]

export const MAX_WIDGET_TITLE_LENGTH = 60

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isCategoryFilter(value: unknown): value is CategoryFilter {
  return value === null || value === 'none' || isId(value)
}

function isCostType(value: unknown): value is CostType {
  return COST_TYPES.some((type) => type === value)
}

function readJson(json: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(json)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** One setting from untrusted input, or the default when it isn't valid or the type doesn't offer it. */
function settingsWith(type: WidgetTypeDefinition, raw: Record<string, unknown>): WidgetSettings {
  const { supports, defaults } = type
  const chartType = supports.chartTypes.find((chart) => chart === raw.chartType) ?? defaults.chartType
  const timeRange = supports.timeRange ? TIME_RANGES.find((range) => range === raw.timeRange) : undefined
  const categoryId = supports.filter !== null && isCategoryFilter(raw.categoryId) ? raw.categoryId : null
  const objectId = supports.filter === 'object' && isId(raw.objectId) ? raw.objectId : null
  const costType = supports.costType && isCostType(raw.costType) ? raw.costType : null
  return { chartType, timeRange: timeRange ?? defaults.timeRange, categoryId, objectId, costType }
}

/**
 * The settings of a stored widget. A value that can't be read (e.g. from an
 * edited export) falls back to the type's default, so a bad value never breaks the dashboard.
 */
export function widgetSettingsFrom(typeId: string, json: string): WidgetSettings {
  const type = findWidgetType(typeId)
  return type ? settingsWith(type, readJson(json)) : { ...BASE_SETTINGS }
}

/*
 * Settings a type doesn't offer are ignored (they keep the default and are never
 * stored), because WidgetSettings is always complete. The ones it offers are checked.
 */

function checkedChartType(type: WidgetTypeDefinition, chartType?: ChartType): ChartType {
  const { supports, defaults } = type
  if (chartType === undefined || supports.chartTypes.length === 0) return defaults.chartType
  if (!supports.chartTypes.includes(chartType)) {
    throw new Error(t('errors.widget.chartType', { title: widgetTypeTitle(type), chartType }))
  }
  return chartType
}

function checkedTimeRange({ supports, defaults }: WidgetTypeDefinition, timeRange?: TimeRange): TimeRange {
  if (timeRange === undefined || !supports.timeRange) return defaults.timeRange
  if (!TIME_RANGES.includes(timeRange)) throw new Error(t('errors.widget.timeRange', { timeRange }))
  return timeRange
}

function checkedFilter(
  type: WidgetTypeDefinition,
  input: Partial<WidgetSettings>,
): Pick<WidgetSettings, 'categoryId' | 'objectId'> {
  const { filter } = type.supports
  const categoryId = filter === null ? null : (input.categoryId ?? null)
  if (!isCategoryFilter(categoryId)) throw new Error(t('errors.widget.categoryFilter'))
  const objectId = filter === 'object' ? (input.objectId ?? null) : null
  if (objectId !== null && !isId(objectId)) throw new Error(t('errors.widget.objectFilter'))
  return { categoryId, objectId }
}

function checkedCostType({ supports }: WidgetTypeDefinition, costType?: CostType | null): CostType | null {
  if (costType === undefined || costType === null || !supports.costType) return null
  if (!isCostType(costType)) throw new Error(t('errors.widget.costType'))
  return costType
}

/** The settings as stored: a JSON object with only the settings the type offers. */
function storedSettings({ supports }: WidgetTypeDefinition, settings: WidgetSettings): string {
  const stored: Partial<WidgetSettings> = {}
  if (supports.chartTypes.length > 0) stored.chartType = settings.chartType
  if (supports.timeRange) stored.timeRange = settings.timeRange
  if (supports.filter !== null) stored.categoryId = settings.categoryId
  if (supports.filter === 'object') stored.objectId = settings.objectId
  if (supports.costType) stored.costType = settings.costType
  return JSON.stringify(stored)
}

/**
 * A widget to save, validated (value object): a known type, a valid size, a
 * trimmed title (blank = default), and only settings the type offers.
 */
export class DashboardWidgetValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'DashboardWidgetValues'

  readonly type: string
  readonly size: WidgetSize
  /** null = the type's default title. */
  readonly title: string | null
  readonly settings: WidgetSettings
  /** The settings as stored (see `storedSettings`). */
  readonly settingsJson: string

  private constructor(fields: Omit<DashboardWidgetValues, 'brand'>) {
    this.type = fields.type
    this.size = fields.size
    this.title = fields.title
    this.settings = fields.settings
    this.settingsJson = fields.settingsJson
  }

  static from(input: DashboardWidgetInput): DashboardWidgetValues {
    const type = findWidgetType(input.type)
    if (!type) throw new Error(t('errors.widget.unknownType', { type: input.type }))
    if (!WIDGET_SIZES.includes(input.size)) throw new Error(t('errors.widget.unknownSize', { size: input.size }))
    const title = normaliseText(input.title)
    if (title !== null && title.length > MAX_WIDGET_TITLE_LENGTH) {
      throw new Error(t('errors.widget.titleTooLong', { max: MAX_WIDGET_TITLE_LENGTH }))
    }
    const raw = input.settings ?? {}
    const settings: WidgetSettings = {
      chartType: checkedChartType(type, raw.chartType),
      timeRange: checkedTimeRange(type, raw.timeRange),
      ...checkedFilter(type, raw),
      costType: checkedCostType(type, raw.costType),
    }
    return new DashboardWidgetValues({
      type: type.id,
      size: input.size,
      title,
      settings,
      settingsJson: storedSettings(type, settings),
    })
  }
}
