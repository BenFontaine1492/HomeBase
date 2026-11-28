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
    titleKey: 'nav.projects',
    icon: 'mdi-chart-box-outline',
    to: { name: 'projects' },
    pathPrefix: '/projects',
  },
  { titleKey: 'nav.finances', icon: 'mdi-cash-multiple', to: { name: 'finances' }, pathPrefix: '/finances' },
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
  <!-- On the window background; the pages sit on the lighter layer next to it (main.css). -->
  <v-navigation-drawer permanent width="256" color="background">
    <div class="sidebar__brand">
      <div class="sidebar__logo">
        <v-icon icon="mdi-home-variant" size="22" color="white" />
      </div>
      <div>
        <div class="sidebar__name">HomeBase</div>
        <div class="hb-caption text-medium-emphasis">{{ t('nav.tagline') }}</div>
      </div>
    </div>

    <v-list nav class="hb-nav px-2">
      <v-list-item
        v-for="item in navigationItems"
        :key="item.titleKey"
        :to="item.to"
        :active="isActive(item)"
        :prepend-icon="item.icon"
        :title="t(item.titleKey)"
      />
    </v-list>

    <template #append>
      <v-list nav class="hb-nav px-2 pb-3">
        <v-list-item
          :to="settingsItem.to"
          :active="isActive(settingsItem)"
          :prepend-icon="settingsItem.icon"
          :title="t(settingsItem.titleKey)"
        />
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<style scoped>
.sidebar__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 16px;
}

/* The logo is the only element with a gradient and a glow (shows most in the dark theme). */
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
  font-weight: 600;
  line-height: 1.5rem;
}
</style>
