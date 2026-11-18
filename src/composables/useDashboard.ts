import { readonly, ref, type Ref } from 'vue'
import * as dashboardService from '@/services/dashboard.service'
import {
  findWidgetType,
  type DashboardWidget,
  type DashboardWidgetInput,
  type WidgetSettings,
  type WidgetSize,
} from '@/types/dashboard'
import { describeError } from '@/utils/error'

// Module-level state: shared by every component that calls useDashboard().
/** In display order. */
const widgets = ref<DashboardWidget[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    widgets.value = await dashboardService.listWidgets()
    hasLoaded = true
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  } finally {
    isLoading.value = false
  }
}

/** Loads the layout once; later calls reuse the already loaded state. */
async function ensureLoaded(): Promise<void> {
  if (!hasLoaded && !isLoading.value) await refresh()
}

function toInput({ type, size, title, settings }: DashboardWidget): DashboardWidgetInput {
  return { type, size, title, settings }
}

/**
 * Every change saves the whole layout, then reloads; errors are rethrown for the
 * caller. Widgets of unknown types (e.g. from a newer backup) are left out,
 * because this version can't check their settings.
 */
async function save(layout: readonly DashboardWidgetInput[]): Promise<void> {
  await dashboardService.saveLayout(layout.filter((widget) => findWidgetType(widget.type)))
  await refresh()
}

/** Every widget, with `change` applied to the one with `id`. */
function changed(id: number, change: (input: DashboardWidgetInput) => DashboardWidgetInput): DashboardWidgetInput[] {
  return widgets.value.map((widget) => (widget.id === id ? change(toInput(widget)) : toInput(widget)))
}

/** Adds a widget of a known type at the end, in the type's default size and settings. */
async function addWidget(typeId: string): Promise<void> {
  const type = findWidgetType(typeId)
  if (!type) throw new Error(`Unknown widget type "${typeId}".`)
  await save([...widgets.value.map(toInput), { type: type.id, size: type.defaultSize, settings: type.defaults }])
}

async function removeWidget(id: number): Promise<void> {
  await save(widgets.value.filter((widget) => widget.id !== id).map(toInput))
}

/** Moves a widget to `index` in the layout (clamped to the list). */
async function moveWidget(id: number, index: number): Promise<void> {
  const layout = widgets.value.filter((widget) => widget.id !== id)
  const moving = widgets.value.filter((widget) => widget.id === id)
  const target = Math.min(Math.max(index, 0), layout.length)
  await save([...layout.slice(0, target), ...moving, ...layout.slice(target)].map(toInput))
}

async function resizeWidget(id: number, size: WidgetSize): Promise<void> {
  await save(changed(id, (input) => ({ ...input, size })))
}

/** Saves the title (blank = the type's default) and settings of a widget. */
async function configureWidget(id: number, title: string | null, settings: WidgetSettings): Promise<void> {
  await save(changed(id, (input) => ({ ...input, title, settings })))
}

/** Replaces the layout with the default one. */
async function resetToDefault(): Promise<void> {
  await dashboardService.resetLayout()
  await refresh()
}

export interface UseDashboard {
  widgets: Readonly<Ref<readonly DashboardWidget[]>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  addWidget: (typeId: string) => Promise<void>
  removeWidget: (id: number) => Promise<void>
  moveWidget: (id: number, index: number) => Promise<void>
  resizeWidget: (id: number, size: WidgetSize) => Promise<void>
  configureWidget: (id: number, title: string | null, settings: WidgetSettings) => Promise<void>
  resetToDefault: () => Promise<void>
}

export function useDashboard(): UseDashboard {
  return {
    widgets: readonly(widgets) as Readonly<Ref<readonly DashboardWidget[]>>,
    isLoading: readonly(isLoading),
    error: readonly(error),
    refresh,
    ensureLoaded,
    addWidget,
    removeWidget,
    moveWidget,
    resizeWidget,
    configureWidget,
    resetToDefault,
  }
}
