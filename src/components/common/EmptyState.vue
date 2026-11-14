<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  text?: string
}>()
</script>

<template>
  <div class="empty-state">
    <div class="empty-state__icon">
      <v-icon :icon="icon" size="28" color="primary" />
    </div>
    <div class="empty-state__title">{{ title }}</div>
    <p v-if="text" class="empty-state__text">{{ text }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
}

.empty-state__icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 16px;
  border-radius: 16px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.empty-state__title {
  font-size: 1rem;
  font-weight: 600;
}

.empty-state__text {
  max-width: 420px;
  margin-top: 6px;
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
