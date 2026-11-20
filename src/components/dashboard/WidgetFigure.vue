<script setup lang="ts">
/** The headline number of a widget with a note next to it, e.g. "€1,250" and "Last 12 months". */
defineProps<{
  value: string
  note?: string
}>()
</script>

<template>
  <div class="widget-figure">
    <span class="hb-title hb-numeric">{{ value }}</span>
    <span v-if="note" class="hb-caption text-medium-emphasis">{{ note }}</span>
  </div>
</template>

<style scoped>
.widget-figure {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 8px;
  margin-bottom: 8px;
}
</style>
