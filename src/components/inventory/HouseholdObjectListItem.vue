<script setup lang="ts">
import { computed } from 'vue'
import type { HouseholdObject } from '@/types/household-object'
import { formatCents } from '@/utils/currency'

const props = defineProps<{
  object: HouseholdObject
  /** Shown as a chip when set (List view). The category page omits it. */
  categoryName?: string
  categoryIcon?: string
}>()

defineEmits<{
  open: [object: HouseholdObject]
  edit: [object: HouseholdObject]
  delete: [object: HouseholdObject]
}>()

const subtitle = computed<string>(() =>
  [[props.object.manufacturer, props.object.model].filter(Boolean).join(' '), props.object.location]
    .filter(Boolean)
    .join(' · '),
)
</script>

<template>
  <div
    class="object-item"
    role="button"
    tabindex="0"
    @click="$emit('open', object)"
    @keydown.enter.self="$emit('open', object)"
  >
    <div class="object-item__content">
      <div class="object-item__title">{{ object.name }}</div>
      <div v-if="subtitle" class="object-item__subtitle">{{ subtitle }}</div>
    </div>
    <v-chip
      v-if="categoryName"
      :prepend-icon="categoryIcon"
      size="small"
      variant="tonal"
      class="object-item__category"
    >
      {{ categoryName }}
    </v-chip>
    <div class="object-item__price">
      <template v-if="object.purchasePriceCents !== null">
        {{ formatCents(object.purchasePriceCents) }}
      </template>
    </div>
    <div @click.stop @keydown.stop>
      <v-menu location="bottom end">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="{ ...menuProps, 'aria-label': `Actions for ${object.name}` }"
            icon="mdi-dots-vertical"
            variant="text"
            size="small"
            density="comfortable"
            class="object-item__actions"
          />
        </template>
        <v-list density="compact" min-width="160" rounded="lg">
          <v-list-item prepend-icon="mdi-pencil-outline" title="Edit" @click="$emit('edit', object)" />
          <v-list-item
            prepend-icon="mdi-trash-can-outline"
            title="Delete"
            base-color="error"
            @click="$emit('delete', object)"
          />
        </v-list>
      </v-menu>
    </div>
  </div>
</template>

<style scoped>
.object-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 24px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.object-item:hover,
.object-item:focus-visible {
  background: rgba(var(--v-theme-primary), 0.03);
  outline: none;
}

.object-item__content {
  flex: 1;
  min-width: 0;
}

.object-item__title {
  font-size: 0.9375rem;
  font-weight: 600;
}

.object-item__subtitle {
  margin-top: 2px;
  overflow: hidden;
  font-size: 0.8125rem;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.object-item__category {
  flex-shrink: 0;
}

.object-item__price {
  flex-shrink: 0;
  min-width: 90px;
  font-size: 0.9375rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.object-item__actions {
  margin-right: -8px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
</style>
