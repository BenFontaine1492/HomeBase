<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import HouseholdObjectPanel from '@/components/inventory/HouseholdObjectPanel.vue'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { UNCATEGORIZED_LABEL } from '@/types/household-category'

/** Route param: a category id, or 'none' for objects without a category. */
const props = defineProps<{
  categoryId: string
}>()

const router = useRouter()

const categoryStore = useHouseholdCategories()
const objectStore = useHouseholdObjects()

const isUncategorized = computed<boolean>(() => props.categoryId === 'none')
const numericId = computed<number | null>(() => {
  if (isUncategorized.value) return null
  const id = Number(props.categoryId)
  return Number.isSafeInteger(id) ? id : null
})
const category = computed(() =>
  numericId.value === null ? undefined : categoryStore.findCategory(numericId.value),
)

const objects = computed(() => objectStore.objectsInCategory(category.value?.id ?? null))
const isLoading = computed<boolean>(
  () => categoryStore.isLoading.value || objectStore.isLoading.value,
)
const loadError = computed<string | null>(
  () => categoryStore.error.value ?? objectStore.error.value,
)

const title = computed<string>(() => category.value?.name ?? UNCATEGORIZED_LABEL)

const hasLoaded = ref(false)
const objectPanel = ref<InstanceType<typeof HouseholdObjectPanel> | null>(null)

function backToInventory(): void {
  void router.replace({ name: 'inventory' })
}

function openAddObject(): void {
  objectPanel.value?.openCreateDialog()
}

function retry(): void {
  void Promise.all([categoryStore.refresh(), objectStore.refresh()])
}

// Categories are edited/deleted only on the overview (tile ⋮ menu).
// Unknown or deleted category → back to the overview (once the data is loaded).
watch(
  [hasLoaded, category, isUncategorized],
  () => {
    if (hasLoaded.value && !loadError.value && !isUncategorized.value && !category.value) {
      backToInventory()
    }
  },
)

onMounted(async () => {
  await Promise.all([categoryStore.ensureLoaded(), objectStore.ensureLoaded()])
  hasLoaded.value = true
})
</script>

<template>
  <div>
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      class="back-link mb-4"
      :to="{ name: 'inventory' }"
    >
      Inventory
    </v-btn>

    <PageHeader :title="title" :subtitle="category?.description ?? undefined">
      <template #actions>
        <v-btn
          color="primary"
          variant="flat"
          size="large"
          prepend-icon="mdi-plus"
          v-bind="{ onClick: openAddObject }"
        >
          Add object
        </v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="loadError" type="error" class="mb-6" title="Could not load the inventory">
      {{ loadError }}
      <template #append>
        <v-btn variant="text" size="small" v-bind="{ onClick: retry }">Retry</v-btn>
      </template>
    </v-alert>

    <HouseholdObjectPanel
      ref="objectPanel"
      :objects="objects"
      :loading="isLoading"
      :title="title"
      :default-category-id="category?.id ?? null"
      lock-category
      empty-title="No objects in this category"
      :empty-text="
        category
          ? `Add the first object to ${category.name}.`
          : 'Objects without a category are listed here.'
      "
    />
  </div>
</template>

<style scoped>
.back-link {
  margin-left: -12px;
}
</style>
