<script setup lang="ts">
import StatusBadge from '@/components/common/StatusBadge.vue'
import { PRIORITY_COLORS, priorityLabel, type InvestmentPriority } from '@/types/investment'

defineProps<{ priority: InvestmentPriority }>()
</script>

<template>
  <StatusBadge :color="PRIORITY_COLORS[priority]">{{ priorityLabel(priority) }}</StatusBadge>
</template>
