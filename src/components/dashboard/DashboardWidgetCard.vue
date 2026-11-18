<script setup lang="ts">
import { computed } from 'vue'
import { WIDGET_COMPONENTS } from './widget-registry'
import {
  WIDGET_SIZES,
  WIDGET_SIZE_LABELS,
  findWidgetType,
  widgetTitle,
  type DashboardWidget,
  type WidgetSize,
} from '@/types/dashboard'

/**
 * The frame of one widget: title, and in edit mode a drag handle and a menu
 * (settings, size, move, remove). The widget itself comes from the registry;
 * unknown types (e.g. from a newer backup) get a placeholder.
 */
const props = defineProps<{
  widget: DashboardWidget
  editing: boolean
  isFirst: boolean
  isLast: boolean
}>()

const emit = defineEmits<{
  configure: []
  resize: [size: WidgetSize]
  move: [delta: -1 | 1]
  remove: []
}>()

const type = computed(() => findWidgetType(props.widget.type))
const component = computed(() => WIDGET_COMPONENTS[props.widget.type])
const title = computed<string>(() => widgetTitle(props.widget))
</script>

<template>
  <v-card class="widget-card" :class="{ 'widget-card--editing': editing }">
    <div class="widget-card__header">
      <v-icon v-if="editing" icon="mdi-drag" class="widget-card__handle" size="20" />
      <v-icon :icon="type?.icon ?? 'mdi-help-box-outline'" color="primary" size="20" />
      <h2 class="widget-card__title">{{ title }}</h2>
      <v-spacer />

      <v-menu v-if="editing" location="bottom end">
        <template #activator="{ props: menuProps }">
          <v-btn
            icon="mdi-dots-vertical"
            size="small"
            variant="text"
            v-bind="{ ...menuProps, 'aria-label': `Edit widget ${title}` }"
          />
        </template>
        <v-list density="compact" min-width="200">
          <v-list-item v-if="type" prepend-icon="mdi-tune-variant" title="Settings…" @click="emit('configure')" />
          <v-list-subheader v-if="type">Size</v-list-subheader>
          <template v-if="type">
            <v-list-item
              v-for="size in WIDGET_SIZES"
              :key="size"
              :title="WIDGET_SIZE_LABELS[size]"
              :prepend-icon="widget.size === size ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank'"
              :active="widget.size === size"
              color="primary"
              @click="emit('resize', size)"
            />
          </template>
          <v-divider class="my-1" />
          <v-list-item prepend-icon="mdi-arrow-up" title="Move up" :disabled="isFirst" @click="emit('move', -1)" />
          <v-list-item prepend-icon="mdi-arrow-down" title="Move down" :disabled="isLast" @click="emit('move', 1)" />
          <v-divider class="my-1" />
          <v-list-item prepend-icon="mdi-trash-can-outline" title="Remove" base-color="error" @click="emit('remove')" />
        </v-list>
      </v-menu>
    </div>

    <div class="widget-card__body">
      <component :is="component" v-if="component" :settings="widget.settings" :size="widget.size" />
      <p v-else class="widget-card__unknown">
        This widget ("{{ widget.type }}") is not known to this version of HomeBase, maybe from a backup of a newer
        version. It is removed the next time you change the dashboard.
      </p>
    </div>
  </v-card>
</template>

<style scoped>
.widget-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.widget-card--editing {
  border-style: dashed;
  border-color: rgba(var(--v-theme-primary), 0.5);
  cursor: grab;
}

.widget-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 12px 12px 4px 20px;
}

.widget-card__handle {
  margin-left: -8px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.widget-card__title {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
}

.widget-card__body {
  flex: 1 1 auto;
  padding: 8px 20px 20px;
}

.widget-card__unknown {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
