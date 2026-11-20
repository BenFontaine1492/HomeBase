<script setup lang="ts">
import { computed } from 'vue'

/**
 * Details of a row as separate items with a gap, instead of joining them with "·".
 * Empty items are left out; the default slot adds items of its own (e.g. a coloured one).
 */
const props = defineProps<{
  items: readonly (string | null | undefined | false)[]
}>()

const shown = computed<string[]>(() =>
  props.items.filter((item): item is string => typeof item === 'string' && item !== ''),
)
</script>

<template>
  <div class="meta-list hb-caption text-medium-emphasis">
    <span v-for="(item, index) in shown" :key="index">{{ item }}</span>
    <slot />
  </div>
</template>

<style scoped>
.meta-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
}
</style>
