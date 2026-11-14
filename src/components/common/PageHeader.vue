<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="page-header">
    <div>
      <h1 class="page-header__title">{{ title }}</h1>
      <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 32px;
}

.page-header__title {
  font-size: 1.875rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.page-header__subtitle {
  margin-top: 6px;
  font-size: 0.9375rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.page-header__actions {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}
</style>
