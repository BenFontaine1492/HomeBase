<script setup lang="ts">
import InvestmentListItem from './InvestmentListItem.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { Investment } from '@/types/investment'

defineProps<{
  investments: readonly Investment[]
  loading: boolean
}>()

defineEmits<{
  edit: [investment: Investment]
  delete: [investment: Investment]
}>()
</script>

<template>
  <v-card class="priority-list">
    <div class="priority-list__header">
      <div>
        <div class="priority-list__title">Priority list</div>
        <div class="priority-list__subtitle">Ordered from most to least important</div>
      </div>
    </div>

    <v-divider />

    <div v-if="loading && investments.length === 0" class="pa-6">
      <v-skeleton-loader v-for="n in 3" :key="n" type="list-item-two-line" />
    </div>

    <EmptyState
      v-else-if="investments.length === 0"
      icon="mdi-lightbulb-on-outline"
      title="No investments planned yet"
      text="Add your first planned purchase to start prioritising your household investments."
    />

    <template v-else>
      <template v-for="(investment, index) in investments" :key="investment.id">
        <v-divider v-if="index > 0" />
        <InvestmentListItem
          :investment="investment"
          :rank="index + 1"
          @edit="$emit('edit', $event)"
          @delete="$emit('delete', $event)"
        />
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
</style>
