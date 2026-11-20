<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { t } from '@/i18n'

/**
 * Title of a page, with optional parent pages in front of it (a breadcrumb, as in
 * Windows Settings: "Inventory › Heating › Gas boiler") and actions on the right.
 */
defineProps<{
  title: string
  subtitle?: string
  /** Parent pages, outermost first; the title is the current page. */
  breadcrumbs?: readonly { title: string; to: RouteLocationRaw }[]
}>()
</script>

<template>
  <header class="page-header">
    <div class="page-header__heading">
      <nav v-if="breadcrumbs?.length" :aria-label="t('nav.breadcrumb')">
        <ol class="page-header__crumbs hb-title">
          <li v-for="(crumb, index) in breadcrumbs" :key="index" class="page-header__crumb">
            <router-link :to="crumb.to" class="page-header__link text-medium-emphasis">{{ crumb.title }}</router-link>
            <v-icon icon="mdi-chevron-right" size="20" class="text-medium-emphasis" />
          </li>
          <li aria-current="page">
            <h1 class="hb-title">{{ title }}</h1>
          </li>
        </ol>
      </nav>
      <h1 v-else class="hb-title">{{ title }}</h1>
      <p v-if="subtitle" class="page-header__subtitle text-medium-emphasis">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px 24px;
  margin-bottom: 24px;
}

.page-header__heading {
  min-width: 0;
}

.page-header__crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.page-header__crumb {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-header__link {
  text-decoration: none;
}

.page-header__link:hover {
  text-decoration: underline;
}

.page-header__subtitle {
  margin-top: 4px;
}

.page-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
