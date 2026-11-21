<script setup lang="ts">
import SectionHeader from './SectionHeader.vue'

/**
 * A section of a page as in Windows Settings: its header (title, count, description,
 * actions) and below it the content, usually ListRows (one card each) or an EmptyState
 * in a card, stacked with a small gap.
 */
defineProps<{
  title: string
  count?: number
  subtitle?: string
}>()
</script>

<template>
  <section class="list-section">
    <SectionHeader :title="title" :count="count" :subtitle="subtitle">
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </SectionHeader>
    <div class="list-section__rows">
      <slot />
    </div>
  </section>
</template>

<style scoped>
/*
 * minmax(0, 1fr): an implicit grid column is never narrower than its content's min-content
 * width, so a truncated text (nowrap, e.g. a long link in a description) would widen the
 * rows beyond the window instead of being cut off with "…".
 */
.list-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

.list-section__rows {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
}
</style>
