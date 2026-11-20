<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import ActionsMenu from '@/components/common/ActionsMenu.vue'
import MaintenanceStatusChip from '@/components/maintenance/MaintenanceStatusChip.vue'
import { t } from '@/i18n'
import type { MaintenanceSummary } from '@/types/maintenance-schedule'

const props = defineProps<{
  title: string
  icon: string
  description?: string | null
  count: number
  to: RouteLocationRaw
  /** Grey icon for the "No category assigned" tile. */
  muted?: boolean
  /** Show the ⋯ menu (Edit / Delete). Off for "No category assigned". */
  showActions?: boolean
  /** Maintenance of the objects in it: a badge when something is overdue or due soon. */
  maintenance?: MaintenanceSummary
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

const countLabel = computed<string>(() => t('common.objectCount', { count: props.count }))

const actions = computed(() => [
  { title: t('inventory.categoryMenu.edit'), icon: 'mdi-pencil-outline', onSelect: () => emit('edit') },
  {
    title: t('inventory.categoryMenu.delete'),
    icon: 'mdi-trash-can-outline',
    danger: true,
    onSelect: () => emit('delete'),
  },
])
</script>

<template>
  <!--
    The menu is a sibling of the link card (not inside it), so clicking ⋯ opens
    the menu instead of being swallowed by the card's navigation.
  -->
  <div class="category-tile">
    <v-card :to="to" class="category-tile__card">
      <v-icon :icon="icon" size="24" :class="muted ? 'text-medium-emphasis' : 'text-primary'" />
      <div class="category-tile__title hb-body-strong">{{ title }}</div>
      <div v-if="description" class="hb-caption text-medium-emphasis">{{ description }}</div>
      <div class="category-tile__footer">
        <span class="hb-caption text-medium-emphasis">{{ countLabel }}</span>
        <MaintenanceStatusChip v-if="maintenance" :summary="maintenance" urgent-only />
      </div>
    </v-card>
    <div v-if="showActions" class="category-tile__menu">
      <ActionsMenu :label="t('common.actionsFor', { name: title })" :actions="actions" />
    </div>
  </div>
</template>

<style scoped>
.category-tile {
  position: relative;
}

.category-tile__card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  padding: 16px;
}

.category-tile__title {
  margin-top: 8px;
  padding-right: 32px;
}

.category-tile__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
}

.category-tile__menu {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}
</style>
