<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import {
  COST_TYPES,
  costTypeLabel,
  TAXES,
  taxesGroupLabel,
  type CostFilter,
  type CostType,
  type TaxCategoryFilter,
} from '@/types/cost'
import type { TaxCategory } from '@/types/tax-category'

/** Year, cost type and tax category filters of the Costs view. */
const props = defineProps<{
  years: readonly number[]
  categories: readonly TaxCategory[]
}>()

const filter = defineModel<CostFilter>({ required: true })

/** v-select can't hold null as a value, so "all" is 'all'. */
const ALL = 'all'

const yearOptions = computed(() => [
  { title: t('costs.filters.allYears'), value: ALL },
  ...props.years.map((year) => ({ title: String(year), value: year })),
])
const typeOptions = computed(() => [
  { title: t('costs.filters.allTypes'), value: ALL },
  ...COST_TYPES.map((type) => ({ title: costTypeLabel(type), value: type })),
])
const categoryOptions = computed(() => [
  { title: t('costs.filters.allCategories'), value: ALL },
  ...props.categories.map((category) => ({ title: category.name, value: category.id })),
  { title: taxesGroupLabel(), value: TAXES },
  { title: t('costs.noTaxCategory'), value: 'none' },
])

const year = computed<number | typeof ALL>({
  get: () => filter.value.year ?? ALL,
  set: (value) => (filter.value = { ...filter.value, year: value === ALL ? null : value }),
})
const costType = computed<CostType | typeof ALL>({
  get: () => filter.value.costType ?? ALL,
  set: (value) => (filter.value = { ...filter.value, costType: value === ALL ? null : value }),
})
const taxCategoryId = computed<Exclude<TaxCategoryFilter, null> | typeof ALL>({
  get: () => filter.value.taxCategoryId ?? ALL,
  set: (value) => (filter.value = { ...filter.value, taxCategoryId: value === ALL ? null : value }),
})
</script>

<template>
  <div class="cost-filters">
    <v-select v-model="year" :label="t('costs.filters.year')" :items="yearOptions" hide-details />
    <v-select v-model="costType" :label="t('costs.filters.costType')" :items="typeOptions" hide-details />
    <v-select v-model="taxCategoryId" :label="t('costs.filters.taxCategory')" :items="categoryOptions" hide-details />
  </div>
</template>

<style scoped>
.cost-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
</style>
