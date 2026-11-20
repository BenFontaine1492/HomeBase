<script setup lang="ts">
/** Header of a section: title (with an optional count), optional description, actions on the right. */
defineProps<{
  title: string
  count?: number
  subtitle?: string
}>()
</script>

<template>
  <div class="section-header">
    <div class="section-header__text">
      <h2 class="hb-body-strong">
        {{ title }}
        <span v-if="count !== undefined" class="section-header__count hb-body text-medium-emphasis">{{ count }}</span>
      </h2>
      <p v-if="subtitle" class="hb-caption text-medium-emphasis">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="section-header__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.section-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 16px;
}

.section-header__text {
  flex: 1 1 240px;
  min-width: 0;
}

.section-header__count {
  margin-left: 4px;
}

.section-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}
</style>
