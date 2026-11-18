<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import CategoryActionsMenu from './CategoryActionsMenu.vue'
import MaintenanceStatusChip from '@/components/maintenance/MaintenanceStatusChip.vue'
import type { MaintenanceSummary } from '@/types/maintenance-schedule'

const props = defineProps<{
  title: string
  icon: string
  description?: string | null
  count: number
  to: RouteLocationRaw
  /** Muted look for the "No category assigned" tile. */
  muted?: boolean
  /** Show the ⋮ menu (Edit / Delete). Off for "No category assigned". */
  showActions?: boolean
  /** Maintenance of the objects in it: a chip when something is overdue or due soon. */
  maintenance?: MaintenanceSummary
}>()

defineEmits<{
  edit: []
  delete: []
}>()

const countLabel = computed<string>(() => `${props.count} ${props.count === 1 ? 'object' : 'objects'}`)
</script>

<template>
  <!--
    The menu is a sibling of the link card (not inside it), so clicking ⋮ opens
    the menu instead of being swallowed by the card's navigation.
  -->
  <div class="category-tile" :class="{ 'category-tile--muted': muted }">
    <v-card :to="to" class="category-tile__card">
      <div class="category-tile__icon">
        <v-icon :icon="icon" size="22" :color="muted ? undefined : 'primary'" />
      </div>
      <div class="category-tile__title">{{ title }}</div>
      <div v-if="description" class="category-tile__description">{{ description }}</div>
      <div class="category-tile__footer">
        <span class="category-tile__count">{{ countLabel }}</span>
        <MaintenanceStatusChip v-if="maintenance" :summary="maintenance" urgent-only />
      </div>
    </v-card>
    <div v-if="showActions" class="category-tile__menu">
      <CategoryActionsMenu :category-name="title" size="small" @edit="$emit('edit')" @delete="$emit('delete')" />
    </div>
  </div>
</template>

<style scoped>
.category-tile {
  position: relative;
}

.category-tile__card {
  height: 100%;
  padding: 20px;
}

.category-tile__menu {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
}

.category-tile__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-bottom: 14px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.category-tile--muted .category-tile__icon {
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.category-tile__title {
  padding-right: 24px;
  font-size: 0.9375rem;
  font-weight: 600;
}

.category-tile__description {
  margin-top: 2px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.category-tile__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}

.category-tile__count {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.45);
}
</style>
