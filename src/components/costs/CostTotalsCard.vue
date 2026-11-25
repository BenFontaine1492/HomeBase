<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import { sumOfCosts, totalsByTaxCategory, type Cost } from '@/types/cost'
import type { TaxCategory } from '@/types/tax-category'
import { formatCents } from '@/utils/currency'

/** The total of the listed costs, and the totals per tax category. */
const props = defineProps<{
  costs: readonly Cost[]
  categories: readonly TaxCategory[]
  /** What the total covers, e.g. "2026" or "All years". */
  caption: string
}>()

const total = computed<number>(() => sumOfCosts(props.costs))
const totals = computed(() => totalsByTaxCategory(props.costs, props.categories))
</script>

<template>
  <v-card class="totals-card">
    <div>
      <div class="hb-caption text-medium-emphasis">{{ caption }}</div>
      <div class="hb-title hb-numeric">{{ formatCents(total) }}</div>
      <div class="hb-caption text-medium-emphasis">{{ t('costs.totals.count', { count: costs.length }) }}</div>
    </div>

    <div class="totals-card__list">
      <div v-for="item in totals" :key="item.group ?? 'none'" class="totals-card__item">
        <span class="totals-card__label hb-caption text-medium-emphasis">{{ item.label }}</span>
        <span v-if="item.labourCents > 0" class="hb-caption text-medium-emphasis hb-numeric">
          {{ t('costs.item.labour', { amount: formatCents(item.labourCents) }) }}
        </span>
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
