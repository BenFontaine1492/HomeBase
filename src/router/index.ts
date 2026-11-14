import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: { name: 'investments' } },
  {
    path: '/inventory',
    name: 'inventory',
    component: () => import('@/views/InventoryView.vue'),
    meta: { title: 'Inventory' },
  },
  {
    // :categoryId is a category id, or 'none' for objects without a category.
    path: '/inventory/category/:categoryId',
    name: 'inventory-category',
    component: () => import('@/views/InventoryCategoryView.vue'),
    props: true,
    meta: { title: 'Inventory' },
  },
  {
    path: '/investments',
    name: 'investments',
    component: () => import('@/views/InvestmentsView.vue'),
    meta: { title: 'Investments' },
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'investments' } },
]

// Hash history works with Tauri's custom protocol without any server-side rewrites.
export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : null
  document.title = title ? `${title} · HomeBase` : 'HomeBase'
})
