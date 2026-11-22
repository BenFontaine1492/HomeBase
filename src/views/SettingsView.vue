<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { t, type MessageKey } from '@/i18n'

interface SettingsSection {
  titleKey: MessageKey
  icon: string
  to: RouteLocationRaw
}

// Add further sections here and as child routes of /settings.
const sections: SettingsSection[] = [
  { titleKey: 'settings.sections.general', icon: 'mdi-tune-variant', to: { name: 'settings-general' } },
  { titleKey: 'settings.sections.data', icon: 'mdi-database-outline', to: { name: 'settings-data' } },
  { titleKey: 'settings.sections.maintenance', icon: 'mdi-wrench-clock', to: { name: 'settings-maintenance' } },
  { titleKey: 'settings.sections.finance', icon: 'mdi-cash-multiple', to: { name: 'settings-finance' } },
]
</script>

<template>
  <div>
    <PageHeader :title="t('nav.settings')" :subtitle="t('settings.subtitle')" />

    <div class="settings-layout">
      <v-list nav class="hb-nav">
        <v-list-item
          v-for="section in sections"
          :key="section.titleKey"
          :to="section.to"
          :prepend-icon="section.icon"
          :title="t(section.titleKey)"
        />
      </v-list>

      <div class="settings-layout__content">
        <router-view />
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
</style>
