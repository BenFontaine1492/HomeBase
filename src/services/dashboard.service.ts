import * as dashboardWidgetRepository from '@/repositories/dashboard-widget.repository'
import {
  DEFAULT_DASHBOARD,
  DashboardWidgetValues,
  type DashboardWidget,
  type DashboardWidgetInput,
} from '@/types/dashboard'

export function listWidgets(): Promise<DashboardWidget[]> {
  return dashboardWidgetRepository.findAll()
}

/**
 * Saves the whole layout: the list order becomes the display order. Every widget
 * is checked first, so an invalid one leaves the stored layout unchanged.
 */
export async function saveLayout(widgets: readonly DashboardWidgetInput[]): Promise<void> {
  await dashboardWidgetRepository.replaceAll(widgets.map((widget) => DashboardWidgetValues.from(widget)))
}

/** Replaces the layout with the default one of a new installation. */
export async function resetLayout(): Promise<void> {
  await saveLayout(DEFAULT_DASHBOARD)
}
