<script setup lang="ts">
import { computed } from 'vue'
import { totalsByCategory, type Categorised } from '@/types/category'
import { formatCents } from '@/utils/currency'

/** The total of the listed costs or income, and the totals per category. */
const props = defineProps<{
  entries: readonly (Categorised & { amountCents: number })[]
  /** What the total covers, e.g. "Costs in 2026" or "All years". */
  caption: string
  /** How many entries, e.g. "3 costs". */
  countLabel: string
}>()

const total = computed<number>(() => props.entries.reduce((sum, entry) => sum + entry.amountCents, 0))
const totals = computed(() => totalsByCategory(props.entries))
</script>

<template>
  <v-card class="totals-card">
    <div>
      <div class="hb-caption text-medium-emphasis">{{ caption }}</div>
      <div class="hb-title hb-numeric">{{ formatCents(total) }}</div>
      <div class="hb-caption text-medium-emphasis">{{ countLabel }}</div>
    </div>

    <div class="totals-card__list">
      <div v-for="item in totals" :key="item.key" class="totals-card__item">
        <span class="totals-card__label hb-caption text-medium-emphasis">{{ item.label }}</span>
        <span class="totals-card__amount hb-body-strong hb-numeric">{{ formatCents(item.amountCents) }}</span>
      </div>
    </div>
  </v-card>
</template>

<style scoped>
.totals-card {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) minmax(280px, 1.3fr);
  gap: 32px;
  align-items: center;
  padding: 24px;
}

.totals-card__list {
  display: grid;
  gap: 8px;
}

.totals-card__item {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.totals-card__label {
  flex: 1;
}

.totals-card__amount {
  min-width: 96px;
  text-align: right;
}

@media (max-width: 1100px) {
  .totals-card {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
</style>
