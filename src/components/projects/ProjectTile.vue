<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import ActionsMenu from '@/components/common/ActionsMenu.vue'
import { t } from '@/i18n'
import { DEFAULT_CHART_PALETTE } from '@/utils/chart-options'

/** A project on the Projects overview: its colour in the roadmap, figures, and a ⋯ menu. */
const props = defineProps<{
  name: string
  description?: string | null
  /** Position in the roadmap: picks the same colour as its chart. */
  colorIndex: number
  /** E.g. "3 investments, 10,000.00 €". */
  summary: string
  /** E.g. "Done 25 Sep 2027". */
  status: string
  to: RouteLocationRaw
  canMoveUp: boolean
  canMoveDown: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
  moveUp: []
  moveDown: []
}>()

const color = computed<string>(() => DEFAULT_CHART_PALETTE[props.colorIndex % DEFAULT_CHART_PALETTE.length]!)

const actions = computed(() => [
  { title: t('projects.menu.edit'), icon: 'mdi-pencil-outline', onSelect: () => emit('edit') },
  {
    title: t('projects.menu.moveUp'),
    icon: 'mdi-arrow-up',
    disabled: !props.canMoveUp,
    onSelect: () => emit('moveUp'),
  },
  {
    title: t('projects.menu.moveDown'),
    icon: 'mdi-arrow-down',
    disabled: !props.canMoveDown,
    onSelect: () => emit('moveDown'),
  },
  { title: t('projects.menu.delete'), icon: 'mdi-trash-can-outline', danger: true, onSelect: () => emit('delete') },
])
</script>

<template>
  <!-- The menu is a sibling of the link card, so clicking ⋯ opens the menu instead of the project. -->
  <div class="project-tile">
    <v-card :to="to" class="project-tile__card">
      <div class="project-tile__title hb-body-strong">
        <span class="project-tile__swatch rounded" :class="`bg-${color}`" />
        {{ name }}
      </div>
      <div v-if="description" class="hb-caption text-medium-emphasis">{{ description }}</div>
      <div class="project-tile__footer">
        <span class="hb-caption text-medium-emphasis hb-numeric">{{ summary }}</span>
        <span class="hb-caption">{{ status }}</span>
      </div>
    </v-card>
    <div class="project-tile__menu">
      <ActionsMenu :label="t('common.actionsFor', { name })" :actions="actions" />
    </div>
  </div>
</template>

<style scoped>
.project-tile {
  position: relative;
}

.project-tile__card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  padding: 16px;
}

.project-tile__title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 32px;
}

.project-tile__swatch {
  flex: none;
  width: 12px;
  height: 12px;
}

.project-tile__footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: auto;
  padding-top: 12px;
}

.project-tile__menu {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}
</style>
