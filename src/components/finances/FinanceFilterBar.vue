<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import { NO_CATEGORY, noCategoryLabel } from '@/types/category'
import type { FinanceFilter } from '@/types/cost'

/** Year and category filters of the costs or the income on the Finances page. */
const props = defineProps<{
  years: readonly number[]
  /** The categories in use (key and label). */
  categories: readonly { key: string; label: string }[]
}>()

const filter = defineModel<FinanceFilter>({ required: true })

/** v-select can't hold null as a value, so "all" is ' all' (no category key, as keys are trimmed text). */
const ALL = ' all'

const yearOptions = computed(() => [
  { title: t('finances.filters.allYears'), value: ALL },
  ...props.years.map((year) => ({ title: String(year), value: year })),
])
const categoryOptions = computed(() => [
  { title: t('finances.filters.allCategories'), value: ALL },
  ...props.categories.map((category) => ({ title: category.label, value: category.key })),
  { title: noCategoryLabel(), value: NO_CATEGORY },
])

const year = computed<number | typeof ALL>({
  get: () => filter.value.year ?? ALL,
  set: (value) => (filter.value = { ...filter.value, year: value === ALL ? null : value }),
})
const category = computed<string>({
  get: () => filter.value.category ?? ALL,
  set: (value) => (filter.value = { ...filter.value, category: value === ALL ? null : value }),
})
</script>

<template>
  <div class="finance-filters">
    <v-select v-model="year" :label="t('finances.filters.year')" :items="yearOptions" hide-details />
    <v-select v-model="category" :label="t('finances.category')" :items="categoryOptions" hide-details />
  </div>
</template>

<style scoped>
.finance-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
</style>
