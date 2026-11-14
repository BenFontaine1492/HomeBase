<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'

interface SettingsSection {
  title: string
  icon: string
  to: RouteLocationRaw
}

// Add further sections (e.g. General, Appearance) here and as child routes of /settings.
const sections: SettingsSection[] = [
  { title: 'Data', icon: 'mdi-database-outline', to: { name: 'settings-data' } },
]
</script>

<template>
  <div>
    <PageHeader title="Settings" subtitle="Configure HomeBase and manage your data" />

    <div class="settings-layout">
      <v-list nav density="comfortable" class="settings-layout__nav">
        <v-list-item
          v-for="section in sections"
          :key="section.title"
          :to="section.to"
          :prepend-icon="section.icon"
          :title="section.title"
          rounded="lg"
          color="primary"
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

.settings-layout__nav {
  padding: 0;
  background: transparent;
}
</style>
