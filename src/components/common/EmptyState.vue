<script setup lang="ts">
/** "Nothing here yet": icon, title, text and optional actions (default slot). `compact` for widgets and tabs. */
defineProps<{
  icon: string
  title: string
  text?: string
  compact?: boolean
}>()
</script>

<template>
  <div class="empty-state" :class="{ 'empty-state--compact': compact }">
    <v-icon :icon="icon" :size="compact ? 24 : 32" class="text-medium-emphasis" />
    <div class="hb-body-strong">{{ title }}</div>
    <p v-if="text" class="empty-state__text hb-caption text-medium-emphasis">{{ text }}</p>
    <div v-if="$slots.default" class="empty-state__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
}

.empty-state--compact {
  padding: 16px 0;
}

.empty-state__text {
  max-width: 420px;
}

.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}
</style>
