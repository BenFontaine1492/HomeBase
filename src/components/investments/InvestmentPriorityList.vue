<script setup lang="ts">
import { ref } from 'vue'
import InvestmentListItem from './InvestmentListItem.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { t } from '@/i18n'
import type { Investment } from '@/types/investment'

/** The planned investments in priority order; drag an item onto another one to take its place. */
const props = defineProps<{
  investments: readonly Investment[]
  loading: boolean
}>()

const emit = defineEmits<{
  edit: [investment: Investment]
  delete: [investment: Investment]
  purchase: [investment: Investment]
  /** Move investment `id` to position `toIndex`. */
  move: [id: number, toIndex: number]
}>()

const draggedId = ref<number | null>(null)
const dropTargetId = ref<number | null>(null)

function onDragStart(investment: Investment, event: DragEvent): void {
  draggedId.value = investment.id
  event.dataTransfer?.setData('text/plain', String(investment.id))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(investment: Investment, event: DragEvent): void {
  if (draggedId.value === null) return
  event.preventDefault()
  dropTargetId.value = investment.id
}

function onDragEnd(): void {
  draggedId.value = null
  dropTargetId.value = null
}

function onDrop(index: number, event: DragEvent): void {
  event.preventDefault()
  const id = draggedId.value
  onDragEnd()
  if (id !== null) emit('move', id, index)
}

function move(investment: Investment, index: number, delta: -1 | 1): void {
  emit('move', investment.id, index + delta)
}

/** Drag-and-drop attributes of a row; only lists with more than one item can be reordered. */
function rowAttributes(investment: Investment, index: number): Record<string, unknown> {
  if (props.investments.length < 2) return {}
  return {
    draggable: true,
    onDragstart: (event: DragEvent) => onDragStart(investment, event),
    onDragover: (event: DragEvent) => onDragOver(investment, event),
    onDragleave: () => (dropTargetId.value = null),
    onDrop: (event: DragEvent) => onDrop(index, event),
    onDragend: onDragEnd,
  }
}
</script>

<template>
  <v-card class="priority-list">
    <div class="priority-list__header">
      <div>
        <div class="priority-list__title">{{ t('investments.list.title') }}</div>
        <div class="priority-list__subtitle">{{ t('investments.list.subtitle') }}</div>
      </div>
    </div>

    <v-divider />

    <div v-if="loading && investments.length === 0" class="pa-6">
      <v-skeleton-loader v-for="n in 3" :key="n" type="list-item-two-line" />
    </div>

    <EmptyState
      v-else-if="investments.length === 0"
      icon="mdi-lightbulb-on-outline"
      :title="t('investments.list.emptyTitle')"
      :text="t('investments.list.emptyText')"
    />

    <template v-else>
      <template v-for="(investment, index) in investments" :key="investment.id">
        <v-divider v-if="index > 0" />
        <div
          v-bind="rowAttributes(investment, index)"
          class="priority-list__row"
          :class="{
            'priority-list__row--dragged': draggedId === investment.id,
            'priority-list__row--target': dropTargetId === investment.id && draggedId !== investment.id,
          }"
        >
          <InvestmentListItem
            :investment="investment"
            :rank="index + 1"
            :reorderable="investments.length > 1"
            :is-first="index === 0"
            :is-last="index === investments.length - 1"
            @edit="emit('edit', $event)"
            @delete="emit('delete', $event)"
            @purchase="emit('purchase', $event)"
            @move="(delta) => move(investment, index, delta)"
          />
        </div>
      </template>
    </template>
  </v-card>
</template>

<style scoped>
.priority-list__header {
  padding: 20px 24px;
}

.priority-list__title {
  font-size: 1rem;
  font-weight: 600;
}

.priority-list__subtitle {
  margin-top: 2px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.priority-list__row {
  transition: opacity 0.15s ease;
}

.priority-list__row--dragged {
  opacity: 0.4;
}

.priority-list__row--target {
  box-shadow: inset 0 2px 0 rgb(var(--v-theme-primary));
}
</style>
