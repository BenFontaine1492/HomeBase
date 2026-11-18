<script setup lang="ts">
import { computed } from 'vue'
import { MAINTENANCE_STATUS_COLORS, summaryLabel, type MaintenanceSummary } from '@/types/maintenance-schedule'

/** Maintenance state of an object or a category, e.g. "2 overdue". Renders nothing when there is nothing to show. */
const props = defineProps<{
  summary: MaintenanceSummary
  /** Only overdue and due-soon maintenance (for lists and tiles). */
  urgentOnly?: boolean
}>()

const label = computed<string | null>(() => {
  const { status } = props.summary
  if (props.urgentOnly && status !== 'overdue' && status !== 'due-soon') return null
  return summaryLabel(props.summary)
})
</script>

<template>
  <v-chip
    v-if="label"
    :color="summary.status ? MAINTENANCE_STATUS_COLORS[summary.status] : undefined"
    prepend-icon="mdi-wrench-clock"
    size="small"
    variant="tonal"
  >
    {{ label }}
  </v-chip>
</template>
