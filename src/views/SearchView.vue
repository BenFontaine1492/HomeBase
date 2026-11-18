<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import PriorityChip from '@/components/investments/PriorityChip.vue'
import MaintenanceStatusChip from '@/components/maintenance/MaintenanceStatusChip.vue'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { useInvestments } from '@/composables/useInvestments'
import { useMaintenance } from '@/composables/useMaintenance'
import { t } from '@/i18n'
import { UNCATEGORIZED_ICON, uncategorizedLabel } from '@/types/household-category'
import type { HouseholdObject } from '@/types/household-object'
import { INVESTMENT_PRIORITIES, INVESTMENT_STATUSES, priorityLabel, statusLabel } from '@/types/investment'
import { maintenanceStatusLabel } from '@/types/maintenance-schedule'
import {
  NO_SEARCH_FILTERS,
  SEARCH_KINDS,
  isSearching,
  searchInvestments,
  searchObjects,
  type SearchFilters,
} from '@/types/search'
import { formatAttributeValue } from '@/utils/attribute-value'
import { formatCents } from '@/utils/currency'

/** Search across objects (incl. their attributes) and investments, with filters. The query is in the URL (?q=). */
const route = useRoute()
const router = useRouter()
const categoryStore = useHouseholdCategories()
const objectStore = useHouseholdObjects()
const investmentStore = useInvestments()
const maintenance = useMaintenance()

const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const filters = reactive<SearchFilters>({ ...NO_SEARCH_FILTERS })

watch(query, (q) => {
  void router.replace({ query: { ...route.query, q: q || undefined } })
})

/** v-select can't hold null as a value: 'any' stands for "no filter". */
const ANY = 'any'
function anyOption(): { title: string; value: typeof ANY } {
  return { title: t('search.any'), value: ANY }
}
function fromChoice<T>(value: T | typeof ANY): T | null {
  return value === ANY ? null : value
}

const categoryOptions = computed(() => [
  anyOption(),
  ...categoryStore.categories.value.map((category) => ({ title: category.name, value: category.id })),
  { title: uncategorizedLabel(), value: 'none' as const },
])
const maintenanceOptions = computed(() => [
  anyOption(),
  ...(['overdue', 'due-soon', 'ok', 'unknown', 'paused'] as const).map((status) => ({
    title: maintenanceStatusLabel(status),
    value: status,
  })),
  { title: t('search.noMaintenance'), value: 'none' as const },
])
const priorityOptions = computed(() => [
  anyOption(),
  ...INVESTMENT_PRIORITIES.map((priority) => ({ title: priorityLabel(priority), value: priority })),
])
const statusOptions = computed(() => [
  anyOption(),
  ...INVESTMENT_STATUSES.map((status) => ({ title: statusLabel(status), value: status })),
])

const searching = computed<boolean>(() => isSearching(query.value, filters))
const objectHits = computed(() =>
  searchObjects(
    {
      objects: objectStore.objects.value,
      categories: categoryStore.categories.value,
      attributes: objectStore.attributes.value,
      maintenanceOf: (object) => maintenance.summaryOf([object]).status,
    },
    query.value,
    filters,
  ),
)
const investmentHits = computed(() => searchInvestments(investmentStore.investments.value, query.value, filters))
const hitCount = computed<number>(() => objectHits.value.length + investmentHits.value.length)

function objectSubtitle(object: HouseholdObject): string {
  const category = categoryStore.findCategory(object.categoryId)?.name ?? uncategorizedLabel()
  const model = [object.manufacturer, object.model].filter(Boolean).join(' ')
  return [category, model, object.location].filter(Boolean).join(' · ')
}

function resetFilters(): void {
  Object.assign(filters, { ...NO_SEARCH_FILTERS, kind: filters.kind })
}

onMounted(() => {
  void Promise.all([
    categoryStore.ensureLoaded(),
    objectStore.ensureLoaded(),
    investmentStore.ensureLoaded(),
    maintenance.ensureLoaded(),
  ])
})
</script>

<template>
  <div>
    <PageHeader :title="t('nav.search')" :subtitle="t('search.subtitle')" />

    <v-text-field
      v-model="query"
      :placeholder="t('search.placeholder')"
      prepend-inner-icon="mdi-magnify"
      clearable
      autofocus
      hide-details
      class="mb-4"
      @click:clear="query = ''"
    />

    <div class="search-filters mb-6">
      <v-btn-toggle
        v-model="filters.kind"
        mandatory
        density="comfortable"
        variant="outlined"
        divided
        rounded="lg"
        color="primary"
      >
        <v-btn v-for="kind in SEARCH_KINDS" :key="kind" :value="kind">{{ t(`search.kinds.${kind}`) }}</v-btn>
      </v-btn-toggle>
      <template v-if="filters.kind !== 'investments'">
        <v-select
          :model-value="filters.categoryId ?? ANY"
          :items="categoryOptions"
          :label="t('common.category')"
          hide-details
          class="search-filters__select"
          @update:model-value="(value: number | 'none' | typeof ANY) => (filters.categoryId = fromChoice(value))"
        />
        <v-select
          :model-value="filters.maintenance ?? ANY"
          :items="maintenanceOptions"
          :label="t('objects.tabs.maintenance')"
          hide-details
          class="search-filters__select"
          @update:model-value="
            (value: SearchFilters['maintenance'] | typeof ANY) => (filters.maintenance = fromChoice(value))
          "
        />
      </template>
      <template v-if="filters.kind !== 'objects'">
        <v-select
          :model-value="filters.priority ?? ANY"
          :items="priorityOptions"
          :label="t('investments.form.priority')"
          hide-details
          class="search-filters__select"
          @update:model-value="
            (value: SearchFilters['priority'] | typeof ANY) => (filters.priority = fromChoice(value))
          "
        />
        <v-select
          :model-value="filters.investmentStatus ?? ANY"
          :items="statusOptions"
          :label="t('search.status')"
          hide-details
          class="search-filters__select"
          @update:model-value="
            (value: SearchFilters['investmentStatus'] | typeof ANY) => (filters.investmentStatus = fromChoice(value))
          "
        />
      </template>
      <v-btn variant="text" prepend-icon="mdi-filter-off-outline" v-bind="{ onClick: resetFilters }">
        {{ t('search.resetFilters') }}
      </v-btn>
    </div>

    <v-card v-if="!searching">
      <EmptyState icon="mdi-magnify" :title="t('search.startTitle')" :text="t('search.startText')" />
    </v-card>

    <v-card v-else-if="hitCount === 0">
      <EmptyState icon="mdi-magnify-close" :title="t('search.noResultsTitle')" :text="t('search.noResultsText')" />
    </v-card>

    <template v-else>
      <v-card v-if="objectHits.length > 0" class="mb-6">
        <div class="search-section">{{ t('search.objects', { count: objectHits.length }) }}</div>
        <v-divider />
        <v-list class="py-0">
          <v-list-item
            v-for="hit in objectHits"
            :key="hit.object.id"
            :to="{ name: 'inventory-object', params: { objectId: hit.object.id } }"
            :prepend-icon="categoryStore.findCategory(hit.object.categoryId)?.icon ?? UNCATEGORIZED_ICON"
            :title="hit.object.name"
            :subtitle="objectSubtitle(hit.object)"
            lines="two"
          >
            <div v-if="hit.matchedAttributes.length > 0" class="search-hit__attributes">
              <span v-for="attribute in hit.matchedAttributes" :key="attribute.id">
                {{ attribute.name }}: {{ formatAttributeValue(attribute) ?? '—' }}
              </span>
            </div>
            <template #append>
              <MaintenanceStatusChip :summary="maintenance.summaryOf([hit.object])" urgent-only />
            </template>
          </v-list-item>
        </v-list>
      </v-card>

      <v-card v-if="investmentHits.length > 0">
        <div class="search-section">{{ t('search.investments', { count: investmentHits.length }) }}</div>
        <v-divider />
        <v-list class="py-0">
          <v-list-item
            v-for="investment in investmentHits"
            :key="investment.id"
            :to="{ name: 'investments' }"
            prepend-icon="mdi-chart-box-outline"
            :title="investment.title"
            :subtitle="`${statusLabel(investment.status)} · ${formatCents(investment.estimatedCostCents)}`"
          >
            <template #append>
              <PriorityChip v-if="investment.status === 'planned'" :priority="investment.priority" />
            </template>
          </v-list-item>
        </v-list>
      </v-card>
    </template>
  </div>
</template>

<style scoped>
.search-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.search-filters__select {
  flex: 0 1 200px;
  min-width: 160px;
}

.search-section {
  padding: 16px 24px;
  font-size: 1rem;
  font-weight: 600;
}

.search-hit__attributes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 2px;
  font-size: 0.75rem;
  color: rgb(var(--v-theme-primary));
}
</style>
