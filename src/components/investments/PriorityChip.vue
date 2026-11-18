<script setup lang="ts">
import { computed } from 'vue'
import { priorityLabel, type InvestmentPriority } from '@/types/investment'

const props = defineProps<{ priority: InvestmentPriority }>()

const color = computed<string>(() => `priority-${props.priority}`)
</script>

<template>
  <v-chip :color="color" variant="tonal" size="small" class="priority-chip">
    <span class="priority-chip__dot" />
    {{ priorityLabel(priority) }}
  </v-chip>
</template>

<style scoped>
.priority-chip__dot {
  width: 7px;
  height: 7px;
  margin-right: 6px;
  border-radius: 50%;
  background: currentColor;
}
</style>
