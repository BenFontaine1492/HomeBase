import { defineAsyncComponent, type Component } from 'vue'

/*
 * The component of each widget type in WIDGET_TYPES (src/types/dashboard.ts).
 * A new widget: add its type there, and its component here. Each component
 * gets the props `settings: WidgetSettings` and `size: WidgetSize`.
 * Loaded on demand, so ECharts is only loaded once a chart is shown.
 */
export const WIDGET_COMPONENTS: Readonly<Record<string, Component>> = {
  'upcoming-maintenance': defineAsyncComponent(() => import('./widgets/UpcomingMaintenanceWidget.vue')),
  'maintenance-costs': defineAsyncComponent(() => import('./widgets/MaintenanceCostsWidget.vue')),
  'recent-objects': defineAsyncComponent(() => import('./widgets/RecentObjectsWidget.vue')),
  'planned-investments': defineAsyncComponent(() => import('./widgets/PlannedInvestmentsWidget.vue')),
  'inventory-overview': defineAsyncComponent(() => import('./widgets/InventoryOverviewWidget.vue')),
}
