<script setup lang="ts">
import { computed, onMounted } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import MetaList from '@/components/common/MetaList.vue'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { t } from '@/i18n'
import type { WidgetSettings, WidgetSize } from '@/types/dashboard'
import { recentObjects, resolveFilter } from '@/types/dashboard-statistics'
import { UNCATEGORIZED_ICON, uncategorizedLabel } from '@/types/household-category'
import type { HouseholdObject } from '@/types/household-object'
import { formatTimestampDate } from '@/utils/date'

/** The objects added to the inventory last. */
const props = defineProps<{
  settings: WidgetSettings
  size: WidgetSize
}>()

const { objects, ensureLoaded: loadObjects } = useHouseholdObjects()
const { categories, findCategory, ensureLoaded: loadCategories } = useHouseholdCategories()

onMounted(() => {
  void Promise.all([loadObjects(), loadCategories()])
})

const resolved = computed(() => resolveFilter(props.settings, categories.value, objects.value))
const shown = computed<HouseholdObject[]>(() =>
  recentObjects(objects.value, resolved.value.filter, props.size === 'large' ? 10 : 5),
)

/** "Heating", "Added 4 Nov 2026". */
function details(object: HouseholdObject): string[] {
  return [
    findCategory(object.categoryId)?.name ?? uncategorizedLabel(),
    t('dashboard.widgets.added', { date: formatTimestampDate(new Date(object.createdAt)) }),
  ]
}
</script>

<template>
  <div>
    <p v-if="resolved.stale" class="hb-caption text-medium-emphasis mb-2">{{ t('dashboard.widgets.staleCategory') }}</p>

    <EmptyState
      v-if="shown.length === 0"
      compact
      icon="mdi-package-variant"
      :title="t('inventory.noObjectsTitle')"
      :text="t('dashboard.widgets.noObjectsText')"
    />

    <v-list v-else density="compact" class="py-0">
      <v-list-item
        v-for="object in shown"
        :key="object.id"
        :to="{ name: 'inventory-object', params: { objectId: object.id } }"
        :prepend-icon="findCategory(object.categoryId)?.icon ?? UNCATEGORIZED_ICON"
        :title="object.name"
        rounded
        class="px-2"
      >
        <MetaList :items="details(object)" />
      </v-list-item>
    </v-list>
  </div>
</template>
