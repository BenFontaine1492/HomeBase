import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DASHBOARD,
  DashboardWidgetValues,
  MAX_WIDGET_TITLE_LENGTH,
  WIDGET_TYPES,
  chartTypeLabel,
  findWidgetType,
  timeRangeLabel,
  widgetSettingsFrom,
  widgetSizeLabel,
  widgetTitle,
  widgetTypeDescription,
  widgetTypeTitle,
  type DashboardWidgetInput,
  type WidgetSettings,
} from '@/types/dashboard'

const DEFAULTS: WidgetSettings = { chartType: 'bar', timeRange: 'last-12-months', categoryId: null, objectId: null }

describe('WIDGET_TYPES', () => {
  it('has unique ids, and defaults the type itself accepts', () => {
    expect(new Set(WIDGET_TYPES.map((type) => type.id)).size).toBe(WIDGET_TYPES.length)
    for (const type of WIDGET_TYPES) {
      expect(() =>
        DashboardWidgetValues.from({ type: type.id, size: type.defaultSize, settings: type.defaults }),
      ).not.toThrow()
    }
  })

  it('finds a type by id', () => {
    const type = findWidgetType('recent-objects')
    expect(type && widgetTypeTitle(type)).toBe('Recently added objects')
    expect(type && widgetTypeDescription(type)).toBe('The objects added to the inventory last.')
    expect(findWidgetType('future-widget')).toBeUndefined()
  })
})

describe('DEFAULT_DASHBOARD', () => {
  it('is valid', () => {
    expect(DEFAULT_DASHBOARD.map((widget) => DashboardWidgetValues.from(widget).type)).toEqual([
      'upcoming-maintenance',
      'recent-objects',
      'maintenance-costs',
    ])
  })
})

describe('widgetTitle', () => {
  it('prefers the custom title, then the type title', () => {
    expect(widgetTitle({ type: 'recent-objects', title: 'New stuff' })).toBe('New stuff')
    expect(widgetTitle({ type: 'recent-objects', title: null })).toBe('Recently added objects')
    expect(widgetTitle({ type: 'future-widget', title: null })).toBe('Unknown widget')
  })
})

describe('widgetSettingsFrom', () => {
  it('reads the settings the type offers', () => {
    const json = JSON.stringify({ chartType: 'line', timeRange: 'all', categoryId: 3, objectId: 7 })
    expect(widgetSettingsFrom('maintenance-costs', json)).toEqual({
      chartType: 'line',
      timeRange: 'all',
      categoryId: 3,
      objectId: 7,
    })
    expect(widgetSettingsFrom('recent-objects', JSON.stringify({ categoryId: 'none' })).categoryId).toBe('none')
  })

  it('falls back to the defaults for missing, invalid or unsupported values', () => {
    const costsDefaults = { ...DEFAULTS, timeRange: 'last-5-years' }
    expect(widgetSettingsFrom('maintenance-costs', '{}')).toEqual(costsDefaults)
    const invalid = JSON.stringify({ chartType: 'radar', timeRange: 'ever', categoryId: -1, objectId: 1.5 })
    expect(widgetSettingsFrom('maintenance-costs', invalid)).toEqual(costsDefaults)
    // recent-objects has no chart, time range or object filter.
    const unsupported = JSON.stringify({ chartType: 'line', timeRange: 'all', categoryId: 2, objectId: 4 })
    expect(widgetSettingsFrom('recent-objects', unsupported)).toEqual({ ...DEFAULTS, categoryId: 2 })
    expect(widgetSettingsFrom('inventory-overview', JSON.stringify({ categoryId: 2 })).categoryId).toBeNull()
  })

  it('falls back to the defaults for broken JSON and unknown types', () => {
    expect(widgetSettingsFrom('recent-objects', 'not json')).toEqual(DEFAULTS)
    expect(widgetSettingsFrom('recent-objects', '[1, 2]')).toEqual(DEFAULTS)
    expect(widgetSettingsFrom('recent-objects', 'null')).toEqual(DEFAULTS)
    expect(widgetSettingsFrom('future-widget', '{"chartType":"line"}')).toEqual(DEFAULTS)
  })
})

describe('DashboardWidgetValues', () => {
  const costs: DashboardWidgetInput = { type: 'maintenance-costs', size: 'large' }

  it('fills in the defaults and stores only the settings the type offers', () => {
    const values = DashboardWidgetValues.from({ type: 'recent-objects', size: 'small', title: '  ' })
    expect(values).toMatchObject({ type: 'recent-objects', size: 'small', title: null, settings: DEFAULTS })
    expect(values.settingsJson).toBe('{"categoryId":null}')
    expect(DashboardWidgetValues.from({ type: 'planned-investments', size: 'small' }).settingsJson).toBe(
      '{"chartType":"pie"}',
    )
    expect(DashboardWidgetValues.from({ type: 'upcoming-maintenance', size: 'small' }).settingsJson).toBe(
      '{"categoryId":null,"objectId":null}',
    )
  })

  it('keeps chosen settings and a trimmed title', () => {
    const values = DashboardWidgetValues.from({
      ...costs,
      title: ' Heating costs ',
      settings: { chartType: 'pie', timeRange: 'this-year', categoryId: 'none', objectId: 4 },
    })
    expect(values.title).toBe('Heating costs')
    expect(values.settings).toEqual({ chartType: 'pie', timeRange: 'this-year', categoryId: 'none', objectId: 4 })
    expect(JSON.parse(values.settingsJson)).toEqual(values.settings)
  })

  it('ignores settings left undefined', () => {
    const values = DashboardWidgetValues.from({ ...costs, settings: { chartType: undefined, categoryId: undefined } })
    expect(values.settings).toEqual({ ...DEFAULTS, timeRange: 'last-5-years' })
  })

  it('rejects unknown types and sizes, and long titles', () => {
    expect(() => DashboardWidgetValues.from({ type: 'future-widget', size: 'small' })).toThrow(
      'Unknown widget type "future-widget".',
    )
    expect(() => DashboardWidgetValues.from({ ...costs, size: 'huge' as never })).toThrow('Unknown widget size "huge".')
    expect(() => DashboardWidgetValues.from({ ...costs, title: 'x'.repeat(MAX_WIDGET_TITLE_LENGTH + 1) })).toThrow(
      `at most ${MAX_WIDGET_TITLE_LENGTH} characters`,
    )
  })

  it('ignores settings the type does not offer (complete settings of another type are fine)', () => {
    const everything: WidgetSettings = { chartType: 'bar', timeRange: 'all', categoryId: 2, objectId: 4 }
    expect(
      DashboardWidgetValues.from({ type: 'recent-objects', size: 'small', settings: everything }).settings,
    ).toEqual({ ...DEFAULTS, categoryId: 2 })
    const investments = DashboardWidgetValues.from({ type: 'planned-investments', size: 'small', settings: everything })
    expect(investments.settings).toEqual(DEFAULTS)
    expect(investments.settingsJson).toBe('{"chartType":"bar"}')
  })

  it('rejects invalid values of the settings the type offers', () => {
    const investments = { type: 'planned-investments', size: 'small' } as const
    expect(() => DashboardWidgetValues.from({ ...investments, settings: { chartType: 'pie' } })).not.toThrow()
    expect(() => DashboardWidgetValues.from({ ...investments, settings: { chartType: 'bar' } })).not.toThrow()
    const costsWith = (settings: Partial<WidgetSettings>) => () => DashboardWidgetValues.from({ ...costs, settings })
    expect(costsWith({ chartType: 'radar' as never })).toThrow(`"Maintenance costs" can't show the chart type "radar".`)
    expect(costsWith({ timeRange: 'ever' as never })).toThrow('Unknown time range "ever".')
    expect(costsWith({ categoryId: 0 })).toThrow('Invalid category filter.')
    expect(costsWith({ objectId: -2 })).toThrow('Invalid object filter.')
  })

  it('rejects a chart type the type has no chart for', () => {
    expect(() =>
      DashboardWidgetValues.from({ type: 'planned-investments', size: 'small', settings: { chartType: 'line' } }),
    ).toThrow(`"Planned investments" can't show the chart type "line".`)
  })
})

describe('labels', () => {
  it('names sizes, chart types and time ranges', () => {
    expect(widgetSizeLabel('small')).toBe('Small')
    expect(chartTypeLabel('pie')).toBe('Doughnut chart')
    expect(timeRangeLabel('last-12-months')).toBe('Last 12 months')
  })
})
