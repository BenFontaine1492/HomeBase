<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { t, type MessageKey } from '@/i18n'

interface NavigationItem {
  titleKey: MessageKey
  icon: string
  to: RouteLocationRaw
  /** Path prefix that keeps the item highlighted on its sub-pages. */
  pathPrefix: string
}

const navigationItems: NavigationItem[] = [
  {
    titleKey: 'nav.dashboard',
    icon: 'mdi-view-dashboard-outline',
    to: { name: 'dashboard' },
    pathPrefix: '/dashboard',
  },
  { titleKey: 'nav.search', icon: 'mdi-magnify', to: { name: 'search' }, pathPrefix: '/search' },
  {
    titleKey: 'nav.inventory',
    icon: 'mdi-package-variant-closed',
    to: { name: 'inventory' },
    pathPrefix: '/inventory',
  },
  {
    titleKey: 'nav.investments',
    icon: 'mdi-chart-box-outline',
    to: { name: 'investments' },
    pathPrefix: '/investments',
  },
]

/** Pinned to the bottom of the sidebar, apart from the main menu. */
const settingsItem: NavigationItem = {
  titleKey: 'nav.settings',
  icon: 'mdi-cog-outline',
  to: { name: 'settings' },
  pathPrefix: '/settings',
}

const route = useRoute()
const router = useRouter()

function isActive(item: NavigationItem): boolean {
  return route.path === item.pathPrefix || route.path.startsWith(`${item.pathPrefix}/`)
}

/** Ctrl+K (or Cmd+K) opens the search from anywhere. */
function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    void router.push({ name: 'search' })
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <v-navigation-drawer permanent width="256" class="sidebar" border="e">
    <div class="sidebar__brand">
      <div class="sidebar__logo">
        <v-icon icon="mdi-home-variant" size="22" color="white" />
      </div>
      <div>
        <div class="sidebar__name">HomeBase</div>
        <div class="sidebar__tagline">{{ t('nav.tagline') }}</div>
      </div>
    </div>

    <div class="sidebar__section-label">{{ t('nav.menu') }}</div>

    <v-list nav density="comfortable" class="sidebar__nav">
      <v-list-item
        v-for="item in navigationItems"
        :key="item.titleKey"
        :to="item.to"
        :active="isActive(item)"
        :prepend-icon="item.icon"
        :title="t(item.titleKey)"
        rounded="lg"
        color="primary"
        class="sidebar__item"
      />
    </v-list>

    <template #append>
      <v-list nav density="comfortable" class="sidebar__nav sidebar__nav--bottom">
        <v-list-item
          :to="settingsItem.to"
          :active="isActive(settingsItem)"
          :prepend-icon="settingsItem.icon"
          :title="t(settingsItem.titleKey)"
          rounded="lg"
          color="primary"
          class="sidebar__item"
        />
      </v-list>
    </template>
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
  background: linear-gradient(135deg, rgb(var(--v-theme-secondary)) 0%, rgb(var(--v-theme-primary)) 100%);
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.3);
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

.sidebar__nav--bottom {
  padding-bottom: 16px;
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
