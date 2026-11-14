<script setup lang="ts">
import { useRoute, type RouteLocationRaw } from 'vue-router'

interface NavigationItem {
  title: string
  icon: string
  to: RouteLocationRaw
  /** Path prefix that keeps the item highlighted on its sub-pages. */
  pathPrefix: string
}

const navigationItems: NavigationItem[] = [
  { title: 'Inventory', icon: 'mdi-package-variant-closed', to: { name: 'inventory' }, pathPrefix: '/inventory' },
  { title: 'Investments', icon: 'mdi-chart-box-outline', to: { name: 'investments' }, pathPrefix: '/investments' },
]

const route = useRoute()

function isActive(item: NavigationItem): boolean {
  return route.path === item.pathPrefix || route.path.startsWith(`${item.pathPrefix}/`)
}
</script>

<template>
  <v-navigation-drawer permanent width="256" class="sidebar" border="e">
    <div class="sidebar__brand">
      <div class="sidebar__logo">
        <v-icon icon="mdi-home-variant" size="22" color="white" />
      </div>
      <div>
        <div class="sidebar__name">HomeBase</div>
        <div class="sidebar__tagline">Household manager</div>
      </div>
    </div>

    <div class="sidebar__section-label">Menu</div>

    <v-list nav density="comfortable" class="sidebar__nav">
      <v-list-item
        v-for="item in navigationItems"
        :key="item.title"
        :to="item.to"
        :active="isActive(item)"
        :prepend-icon="item.icon"
        :title="item.title"
        rounded="lg"
        color="primary"
        class="sidebar__item"
      />
    </v-list>
  </v-navigation-drawer>
</template>

<style scoped>
.sidebar {
  background: rgb(var(--v-theme-surface));
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 28px 20px 24px;
}

.sidebar__logo {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #7c5cff 0%, rgb(var(--v-theme-primary)) 100%);
  box-shadow: 0 4px 12px rgba(91, 71, 224, 0.3);
}

.sidebar__name {
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.sidebar__tagline {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.sidebar__section-label {
  padding: 8px 24px 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.45);
}

.sidebar__nav {
  padding: 4px 12px;
}

.sidebar__item {
  min-height: 44px;
  margin-bottom: 4px;
  font-weight: 500;
}

/* Active state: tonal primary background plus an accent bar. */
.sidebar__item.v-list-item--active {
  font-weight: 600;
}

.sidebar__item.v-list-item--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: rgb(var(--v-theme-primary));
}

.sidebar__item :deep(.v-list-item__prepend > .v-icon) {
  opacity: 0.85;
}
</style>
