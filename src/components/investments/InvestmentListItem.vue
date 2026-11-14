<script setup lang="ts">
import PriorityChip from './PriorityChip.vue'
import type { Investment } from '@/types/investment'
import { formatCents } from '@/utils/currency'

defineProps<{
  investment: Investment
  rank: number
}>()

defineEmits<{
  edit: [investment: Investment]
  delete: [investment: Investment]
}>()
</script>

<template>
  <div class="investment-item">
    <!-- Placeholder: drag-and-drop reordering is not implemented yet. -->
    <v-icon
      icon="mdi-drag-vertical"
      class="investment-item__handle"
      size="20"
      aria-label="Drag to reorder (coming soon)"
    />
    <div class="investment-item__rank">{{ rank }}</div>
    <div class="investment-item__content">
      <div class="investment-item__title">{{ investment.title }}</div>
      <div v-if="investment.description" class="investment-item__description">
        {{ investment.description }}
      </div>
    </div>
    <PriorityChip :priority="investment.priority" class="investment-item__priority" />
    <div class="investment-item__cost">
      <div class="investment-item__cost-value">{{ formatCents(investment.estimatedCostCents) }}</div>
      <div class="investment-item__cost-label">Estimated</div>
    </div>
    <v-menu location="bottom end">
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="menuProps"
          icon="mdi-dots-vertical"
          variant="text"
          size="small"
          density="comfortable"
          class="investment-item__actions"
          :aria-label="`Actions for ${investment.title}`"
        />
      </template>
      <v-list density="compact" min-width="160" rounded="lg">
        <v-list-item
          prepend-icon="mdi-pencil-outline"
          title="Edit"
          @click="$emit('edit', investment)"
        />
        <v-list-item
          prepend-icon="mdi-trash-can-outline"
          title="Delete"
          base-color="error"
          @click="$emit('delete', investment)"
        />
      </v-list>
    </v-menu>
  </div>
</template>

<style scoped>
.investment-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px 16px 12px;
  transition: background-color 0.15s ease;
}

.investment-item:hover {
  background: rgba(var(--v-theme-primary), 0.03);
}

.investment-item__handle {
  cursor: grab;
  color: rgba(var(--v-theme-on-surface), 0.3);
  transition: color 0.15s ease;
}

.investment-item:hover .investment-item__handle {
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.investment-item__rank {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
}

.investment-item__content {
  flex: 1;
  min-width: 0;
}

.investment-item__title {
  font-size: 0.9375rem;
  font-weight: 600;
}

.investment-item__description {
  margin-top: 2px;
  overflow: hidden;
  font-size: 0.8125rem;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.investment-item__priority {
  flex-shrink: 0;
}

.investment-item__cost {
  flex-shrink: 0;
  min-width: 110px;
  text-align: right;
}

.investment-item__cost-value {
  font-size: 0.9375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.investment-item__actions {
  flex-shrink: 0;
  margin-right: -8px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.investment-item__cost-label {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>
