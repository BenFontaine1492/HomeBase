<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeader from '@/components/common/PageHeader.vue'

interface InventoryCategory {
  title: string
  icon: string
  description: string
}

// Static placeholders that outline the planned structure of the inventory.
const categories: InventoryCategory[] = [
  { title: 'Heating', icon: 'mdi-radiator', description: 'Boilers, heat pumps, radiators' },
  { title: 'Energy', icon: 'mdi-solar-power-variant', description: 'Solar panels, batteries' },
  { title: 'Appliances', icon: 'mdi-washing-machine', description: 'Kitchen and laundry' },
  { title: 'Other', icon: 'mdi-toolbox-outline', description: 'Everything else' },
]
</script>

<template>
  <div>
    <PageHeader
      title="Inventory"
      subtitle="Keep track of your household objects, warranties and maintenance"
    >
      <template #actions>
        <v-btn color="primary" variant="flat" size="large" prepend-icon="mdi-plus" disabled>
          Add Object
        </v-btn>
      </template>
    </PageHeader>

    <div class="category-grid mb-6">
      <v-card v-for="category in categories" :key="category.title" class="category-card">
        <div class="category-card__icon">
          <v-icon :icon="category.icon" size="22" color="primary" />
        </div>
        <div class="category-card__title">{{ category.title }}</div>
        <div class="category-card__description">{{ category.description }}</div>
        <div class="category-card__count">0 objects</div>
      </v-card>
    </div>

    <v-card>
      <EmptyState
        icon="mdi-package-variant-closed"
        title="Inventory is coming soon"
        text="Here you will manage purchased household objects together with purchase prices, installation dates, warranties and maintenance schedules."
      />
    </v-card>
  </div>
</template>

<style scoped>
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.category-card {
  padding: 20px;
}

.category-card__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-bottom: 14px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.category-card__title {
  font-size: 0.9375rem;
  font-weight: 600;
}

.category-card__description {
  margin-top: 2px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.category-card__count {
  margin-top: 14px;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.45);
}
</style>
