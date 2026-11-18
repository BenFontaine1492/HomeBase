<script setup lang="ts">
import { computed, onMounted } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import type { WidgetSettings, WidgetSize } from '@/types/dashboard'
import { recentObjects, resolveFilter } from '@/types/dashboard-statistics'
import { UNCATEGORIZED_ICON, UNCATEGORIZED_LABEL } from '@/types/household-category'
import type { HouseholdObject } from '@/types/household-object'

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

const addedFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

function subtitle(object: HouseholdObject): string {
  const category = findCategory(object.categoryId)?.name ?? UNCATEGORIZED_LABEL
  return `${category} · added ${addedFormatter.format(new Date(object.createdAt))}`
}
</script>

<template>
  <div>
    <p v-if="resolved.stale" class="widget-note">The filtered category no longer exists; showing all.</p>

    <EmptyState
      v-if="shown.length === 0"
      icon="mdi-package-variant"
      title="No objects yet"
      text="Objects you add to the inventory show up here."
    />

    <v-list v-else density="compact" class="py-0">
      <v-list-item
        v-for="object in shown"
        :key="object.id"
        :to="{ name: 'inventory-object', params: { objectId: object.id } }"
        :prepend-icon="findCategory(object.categoryId)?.icon ?? UNCATEGORIZED_ICON"
        :title="object.name"
        :subtitle="subtitle(object)"
        rounded="lg"
        class="px-2"
      />
    </v-list>
  </div>
</template>

<style scoped>
.widget-note {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
