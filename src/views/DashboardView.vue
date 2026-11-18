<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import AddWidgetDialog from '@/components/dashboard/AddWidgetDialog.vue'
import DashboardWidgetCard from '@/components/dashboard/DashboardWidgetCard.vue'
import WidgetSettingsDialog from '@/components/dashboard/WidgetSettingsDialog.vue'
import { useDashboard } from '@/composables/useDashboard'
import type { DashboardWidget, WidgetSize } from '@/types/dashboard'
import { describeError } from '@/utils/error'

const { widgets, isLoading, error, ensureLoaded, refresh, moveWidget, resizeWidget, removeWidget, resetToDefault } =
  useDashboard()

onMounted(() => {
  void ensureLoaded()
})

/** Columns of a widget in the 12-column grid: full width on narrow windows. */
const COLUMNS: Readonly<Record<WidgetSize, { cols: number; md?: number; lg?: number }>> = {
  small: { cols: 12, md: 6, lg: 4 },
  medium: { cols: 12, lg: 6 },
  large: { cols: 12 },
}

const isEditing = ref(false)
const isAddOpen = ref(false)
const isResetOpen = ref(false)
const isSettingsOpen = ref(false)
const widgetToConfigure = ref<DashboardWidget | null>(null)

/** Error of the last change made in edit mode (move, resize, remove). */
const changeError = ref<string | null>(null)

async function change(action: () => Promise<void>): Promise<void> {
  changeError.value = null
  try {
    await action()
  } catch (cause) {
    console.error(cause)
    changeError.value = describeError(cause)
  }
}

function configure(widget: DashboardWidget): void {
  widgetToConfigure.value = widget
  isSettingsOpen.value = true
}

// Drag and drop (edit mode): dropping a widget on another one takes its place.
const draggedId = ref<number | null>(null)
const dropTargetId = ref<number | null>(null)

function onDragStart(widget: DashboardWidget, event: DragEvent): void {
  draggedId.value = widget.id
  event.dataTransfer?.setData('text/plain', String(widget.id))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(widget: DashboardWidget, event: DragEvent): void {
  if (draggedId.value === null) return
  event.preventDefault()
  dropTargetId.value = widget.id
}

function onDragEnd(): void {
  draggedId.value = null
  dropTargetId.value = null
}

function onDrop(index: number, event: DragEvent): void {
  event.preventDefault()
  const id = draggedId.value
  onDragEnd()
  if (id !== null) void change(() => moveWidget(id, index))
}

/**
 * Grid columns and drag-and-drop handlers of a widget's cell. Passed with v-bind
 * because v-col declares neither `draggable` nor the drag events.
 */
function cellAttributes(widget: DashboardWidget, index: number): Record<string, unknown> {
  return {
    ...COLUMNS[widget.size],
    draggable: isEditing.value,
    onDragstart: (event: DragEvent) => onDragStart(widget, event),
    onDragover: (event: DragEvent) => onDragOver(widget, event),
    onDragleave: () => (dropTargetId.value = null),
    onDrop: (event: DragEvent) => onDrop(index, event),
    onDragend: onDragEnd,
  }
}
</script>

<template>
  <div>
    <PageHeader title="Dashboard" subtitle="Your household at a glance">
      <template #actions>
        <template v-if="isEditing">
          <v-btn variant="text" prepend-icon="mdi-restore" v-bind="{ onClick: () => (isResetOpen = true) }">
            Reset to default
          </v-btn>
          <v-btn variant="tonal" color="primary" prepend-icon="mdi-plus" v-bind="{ onClick: () => (isAddOpen = true) }">
            Add widget
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-check"
            v-bind="{ onClick: () => (isEditing = false) }"
          >
            Done
          </v-btn>
        </template>
        <v-btn
          v-else
          variant="tonal"
          color="primary"
          prepend-icon="mdi-view-dashboard-edit-outline"
          v-bind="{ onClick: () => (isEditing = true) }"
        >
          Edit dashboard
        </v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="error" type="error" class="mb-6" title="Could not load the dashboard">
      {{ error }}
      <template #append>
        <v-btn variant="text" size="small" v-bind="{ onClick: refresh }">Retry</v-btn>
      </template>
    </v-alert>

    <v-alert v-if="changeError" type="error" class="mb-6" closable @click:close="changeError = null">
      {{ changeError }}
    </v-alert>

    <p v-if="isEditing && widgets.length > 0" class="dashboard__hint">
      Drag widgets to reorder them. Use the ⋮ menu of a widget for its settings, size, or to remove it.
    </p>

    <v-progress-linear v-if="isLoading && widgets.length === 0" indeterminate color="primary" />

    <v-card v-else-if="!error && widgets.length === 0">
      <EmptyState
        icon="mdi-view-dashboard-outline"
        title="The dashboard is empty"
        text="Add widgets, or go back to the default layout."
      >
        <div class="d-flex ga-3 mt-4">
          <v-btn variant="text" prepend-icon="mdi-restore" v-bind="{ onClick: () => (isResetOpen = true) }">
            Reset to default
          </v-btn>
          <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" v-bind="{ onClick: () => (isAddOpen = true) }">
            Add widget
          </v-btn>
        </div>
      </EmptyState>
    </v-card>

    <v-row v-else>
      <v-col
        v-for="(widget, index) in widgets"
        :key="widget.id"
        v-bind="cellAttributes(widget, index)"
        class="dashboard__cell"
        :class="{
          'dashboard__cell--dragged': draggedId === widget.id,
          'dashboard__cell--target': dropTargetId === widget.id && draggedId !== widget.id,
        }"
      >
        <DashboardWidgetCard
          :widget="widget"
          :editing="isEditing"
          :is-first="index === 0"
          :is-last="index === widgets.length - 1"
          @configure="configure(widget)"
          @resize="(size) => change(() => resizeWidget(widget.id, size))"
          @move="(delta) => change(() => moveWidget(widget.id, index + delta))"
          @remove="change(() => removeWidget(widget.id))"
        />
      </v-col>
    </v-row>

    <AddWidgetDialog v-model="isAddOpen" />
    <WidgetSettingsDialog v-model="isSettingsOpen" :widget="widgetToConfigure" />
    <ConfirmDeleteDialog
      v-model="isResetOpen"
      title="Reset the dashboard?"
      confirm-label="Reset"
      :action="resetToDefault"
    >
      All widgets and their settings are replaced by the default layout.
    </ConfirmDeleteDialog>
  </div>
</template>

<style scoped>
.dashboard__hint {
  margin: -16px 0 16px;
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.dashboard__cell {
  transition: opacity 0.15s ease;
}

.dashboard__cell--dragged {
  opacity: 0.4;
}

.dashboard__cell--target :deep(.widget-card) {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.25);
}
</style>
