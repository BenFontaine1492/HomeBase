<script setup lang="ts">
import { computed } from 'vue'
import { WIDGET_COMPONENTS } from './widget-registry'
import { t } from '@/i18n'
import {
  WIDGET_SIZES,
  findWidgetType,
  widgetSizeLabel,
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
      <v-icon v-if="editing" icon="mdi-drag" class="widget-card__handle text-medium-emphasis" size="20" />
      <v-icon :icon="type?.icon ?? 'mdi-help-box-outline'" color="primary" size="20" />
      <h2 class="hb-body-strong">{{ title }}</h2>
      <v-spacer />

      <v-menu v-if="editing" location="bottom end">
        <template #activator="{ props: menuProps }">
          <v-btn
            icon="mdi-dots-horizontal"
            size="small"
            variant="text"
            v-bind="{ ...menuProps, 'aria-label': t('dashboard.card.editWidget', { title }) }"
          />
        </template>
        <v-list density="compact" min-width="200">
          <v-list-item
            v-if="type"
            prepend-icon="mdi-tune-variant"
            :title="t('dashboard.card.settings')"
            @click="emit('configure')"
          />
          <v-list-subheader v-if="type">{{ t('dashboard.card.size') }}</v-list-subheader>
          <template v-if="type">
            <v-list-item
              v-for="size in WIDGET_SIZES"
              :key="size"
              :title="widgetSizeLabel(size)"
              :prepend-icon="widget.size === size ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank'"
              :active="widget.size === size"
              color="primary"
              @click="emit('resize', size)"
            />
          </template>
          <v-divider class="my-1" />
          <v-list-item
            prepend-icon="mdi-arrow-up"
            :title="t('common.moveUp')"
            :disabled="isFirst"
            @click="emit('move', -1)"
          />
          <v-list-item
            prepend-icon="mdi-arrow-down"
            :title="t('common.moveDown')"
            :disabled="isLast"
            @click="emit('move', 1)"
          />
          <v-divider class="my-1" />
          <v-list-item
            prepend-icon="mdi-trash-can-outline"
            :title="t('common.remove')"
            base-color="error"
            @click="emit('remove')"
          />
        </v-list>
      </v-menu>
    </div>

    <div class="widget-card__body">
      <component :is="component" v-if="component" :settings="widget.settings" :size="widget.size" />
      <p v-else class="text-medium-emphasis">
        {{ t('dashboard.card.unknown', { type: widget.type }) }}
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
  border-color: rgb(var(--v-theme-primary));
  cursor: grab;
}

.widget-card__header {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 8px 8px 0 24px;
}

.widget-card__handle {
  margin-left: -8px;
}

.widget-card__body {
  flex: 1 1 auto;
  padding: 8px 24px 24px;
}
</style>
