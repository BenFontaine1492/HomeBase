import { createRouter, createWebHashHistory, type RouteLocationNormalizedLoaded, type RouteRecordRaw } from 'vue-router'
import { t, type MessageKey } from '@/i18n'

declare module 'vue-router' {
  interface RouteMeta {
    /** Page name in the window title. */
    titleKey?: MessageKey
    /** Settings section, shown before the page name. */
    sectionKey?: MessageKey
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: { name: 'dashboard' } },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { titleKey: 'nav.dashboard' },
  },
  {
    // ?q= the query.
    path: '/search',
    name: 'search',
    component: () => import('@/views/SearchView.vue'),
    meta: { titleKey: 'nav.search' },
  },
  {
    path: '/inventory',
    name: 'inventory',
    component: () => import('@/views/InventoryView.vue'),
    meta: { titleKey: 'nav.inventory' },
  },
  {
    // :categoryId is a category id, or 'none' for objects without a category.
    path: '/inventory/category/:categoryId',
    name: 'inventory-category',
    component: () => import('@/views/InventoryCategoryView.vue'),
    props: true,
    meta: { titleKey: 'nav.inventory' },
  },
  {
    path: '/inventory/object/:objectId',
    name: 'inventory-object',
    component: () => import('@/views/HouseholdObjectView.vue'),
    props: true,
    meta: { titleKey: 'nav.inventory' },
  },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('@/views/ProjectsView.vue'),
    meta: { titleKey: 'nav.projects' },
  },
  {
    // ?investment= an investment of the project to open for editing.
    path: '/projects/:projectId',
    name: 'project',
    component: () => import('@/views/ProjectView.vue'),
    props: true,
    meta: { titleKey: 'nav.projects' },
  },
  // The page was called "Investments" before investments were grouped into projects.
  { path: '/investments', redirect: { name: 'projects' } },
  {
    // ?tab=income or ?tab=recurring
    path: '/finances',
    name: 'finances',
    component: () => import('@/views/FinancesView.vue'),
    meta: { titleKey: 'nav.finances' },
  },
  // The page was called "Costs" before income was added.
  { path: '/costs', redirect: { name: 'finances' } },
  {
    path: '/settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { titleKey: 'nav.settings' },
    children: [
      { path: '', name: 'settings', redirect: { name: 'settings-general' } },
      {
        path: 'general',
        name: 'settings-general',
        component: () => import('@/views/settings/SettingsGeneralView.vue'),
        meta: { sectionKey: 'settings.sections.general' },
      },
      {
        path: 'data',
        name: 'settings-data',
        component: () => import('@/views/settings/SettingsDataView.vue'),
        meta: { sectionKey: 'settings.sections.data' },
      },
      {
        path: 'maintenance',
        name: 'settings-maintenance',
        component: () => import('@/views/settings/SettingsMaintenanceView.vue'),
        meta: { sectionKey: 'settings.sections.maintenance' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'dashboard' } },
]

// Hash history works with Tauri's custom protocol without any server-side rewrites.
export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

/** The window title of a page, e.g. "Data – Settings – HomeBase", in the current language. */
export function pageTitle(route: RouteLocationNormalizedLoaded): string {
  const { titleKey, sectionKey } = route.meta
  const parts = [sectionKey, titleKey].flatMap((key) => (key ? [t(key)] : []))
  return [...parts, 'HomeBase'].join(' – ')
}
