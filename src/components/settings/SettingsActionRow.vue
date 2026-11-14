<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  text: string
}>()
</script>

<template>
  <div class="action-row">
    <div class="action-row__icon">
      <v-icon :icon="icon" size="22" color="primary" />
    </div>
    <div class="action-row__body">
      <div class="action-row__title">{{ title }}</div>
      <div class="action-row__text">{{ text }}</div>
    </div>
    <div class="action-row__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.action-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
}

.action-row + .action-row {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.action-row__icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.action-row__body {
  flex: 1;
  min-width: 0;
}

.action-row__title {
  font-size: 0.9375rem;
  font-weight: 600;
}

.action-row__text {
  margin-top: 2px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.action-row__actions {
  flex-shrink: 0;
}
</style>
