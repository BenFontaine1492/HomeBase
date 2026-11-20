<script setup lang="ts">
/**
 * A short status (e.g. "Overdue", "High") in a status colour on its own background
 * (`<color>-container` in plugins/vuetify.ts). Without a colour it is neutral grey.
 */
defineProps<{
  /** Theme status colour: error, warning, success or info. */
  color?: string
  icon?: string
}>()
</script>

<template>
  <span
    class="status-badge hb-caption"
    :class="color ? [`bg-${color}-container`, `text-${color}`] : 'status-badge--neutral'"
  >
    <v-icon v-if="icon" :icon="icon" size="16" />
    <slot />
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-weight: 600;
  white-space: nowrap;
  vertical-align: middle;
}

.status-badge--neutral {
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
