import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardWidget, DashboardWidgetInput, WidgetSettings } from '@/types/dashboard'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({ listWidgets: vi.fn(), saveLayout: vi.fn(), resetLayout: vi.fn() }))
vi.mock('@/services/dashboard.service', () => service)

const SETTINGS: WidgetSettings = {
  chartType: 'bar',
  timeRange: 'last-12-months',
  categoryId: null,
  objectId: null,
  costType: null,
}

function widget(id: number, type: string): DashboardWidget {
  return { id, type, position: id, size: 'medium', title: null, settings: SETTINGS }
}

const LAYOUT = [widget(1, 'upcoming-maintenance'), widget(2, 'recent-objects'), widget(3, 'inventory-overview')]

/** Fresh module-level state for every test, loaded with LAYOUT. */
async function load() {
  vi.resetModules()
  const { useDashboard } = await import('@/composables/useDashboard')
  const state = useDashboard()
  vi.mocked(service.listWidgets).mockResolvedValue(LAYOUT)
  await state.ensureLoaded()
  return state
}

/** The layout passed to the last saveLayout() call. */
function savedLayout(): DashboardWidgetInput[] {
  return vi.mocked(service.saveLayout).mock.lastCall![0] as DashboardWidgetInput[]
}

function savedTypes(): string[] {
  return savedLayout().map((input) => input.type)
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  service.saveLayout.mockResolvedValue(undefined)
  service.resetLayout.mockResolvedValue(undefined)
})

describe('loading', () => {
  it('loads once', async () => {
    const state = await load()
    await state.ensureLoaded()
    expect(service.listWidgets).toHaveBeenCalledTimes(1)
    expect(state.widgets.value).toHaveLength(3)
    expect(state.isLoading.value).toBe(false)
  })

  it('does not start a second load while one is running', async () => {
    vi.resetModules()
    const { useDashboard } = await import('@/composables/useDashboard')
    const state = useDashboard()
    let finish: (rows: DashboardWidget[]) => void = () => {}
    vi.mocked(service.listWidgets).mockReturnValue(new Promise((resolve) => (finish = resolve)))

    const first = state.refresh()
    await state.ensureLoaded()
    finish([])
    await first

    expect(service.listWidgets).toHaveBeenCalledTimes(1)
  })

  it('keeps the error message when loading fails', async () => {
    vi.resetModules()
    const { useDashboard } = await import('@/composables/useDashboard')
    const state = useDashboard()
    vi.mocked(service.listWidgets).mockRejectedValue(new Error('db gone'))
    await state.ensureLoaded()
    expect(state.error.value).toBe('db gone')
  })
})

describe('changes save the whole layout and reload', () => {
  it('adds a widget at the end with the type defaults', async () => {
    const state = await load()
    await state.addWidget('costs')
    expect(savedLayout().at(-1)).toEqual({
      type: 'costs',
      size: 'large',
      settings: { ...SETTINGS, timeRange: 'last-5-years' },
    })
    expect(service.listWidgets).toHaveBeenCalledTimes(2)
  })

  it('rejects unknown widget types', async () => {
    const state = await load()
    await expect(state.addWidget('future-widget')).rejects.toThrow('Unknown widget type "future-widget".')
    expect(service.saveLayout).not.toHaveBeenCalled()
  })

  it('removes a widget', async () => {
    const state = await load()
    await state.removeWidget(2)
    expect(savedTypes()).toEqual(['upcoming-maintenance', 'inventory-overview'])
  })

  it.each([
    [0, ['inventory-overview', 'upcoming-maintenance', 'recent-objects']],
    [1, ['upcoming-maintenance', 'inventory-overview', 'recent-objects']],
    [-5, ['inventory-overview', 'upcoming-maintenance', 'recent-objects']],
    [99, ['upcoming-maintenance', 'recent-objects', 'inventory-overview']],
  ])('moves a widget to index %i', async (index, expected) => {
    const state = await load()
    await state.moveWidget(3, index)
    expect(savedTypes()).toEqual(expected)
  })

  it('resizes and configures one widget', async () => {
    const state = await load()
    await state.resizeWidget(2, 'small')
    expect(savedLayout().map((input) => input.size)).toEqual(['medium', 'small', 'medium'])

    const settings = { ...SETTINGS, categoryId: 4 }
    await state.configureWidget(2, 'New things', settings)
    expect(savedLayout()[1]).toEqual({ type: 'recent-objects', size: 'medium', title: 'New things', settings })
  })

  it('leaves out widgets of unknown types', async () => {
    const state = await load()
    vi.mocked(service.listWidgets).mockResolvedValue([...LAYOUT, widget(4, 'future-widget')])
    await state.refresh()
    await state.removeWidget(1)
    expect(savedTypes()).toEqual(['recent-objects', 'inventory-overview'])
  })

  it('resets to the default layout', async () => {
    const state = await load()
    await state.resetToDefault()
    expect(service.resetLayout).toHaveBeenCalledTimes(1)
    expect(service.listWidgets).toHaveBeenCalledTimes(2)
  })

  it('rethrows save errors without reloading', async () => {
    const state = await load()
    service.saveLayout.mockRejectedValue(new Error('disk full'))
    await expect(state.removeWidget(1)).rejects.toThrow('disk full')
    expect(service.listWidgets).toHaveBeenCalledTimes(1)
  })
})
