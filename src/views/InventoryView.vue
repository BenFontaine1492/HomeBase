<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import CategoryFormDialog from '@/components/inventory/CategoryFormDialog.vue'
import CategoryTile from '@/components/inventory/CategoryTile.vue'
import DeleteCategoryDialog from '@/components/inventory/DeleteCategoryDialog.vue'
import HouseholdObjectPanel from '@/components/inventory/HouseholdObjectPanel.vue'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import {
  UNCATEGORIZED_ICON,
  UNCATEGORIZED_LABEL,
  type HouseholdCategory,
} from '@/types/household-category'

type InventoryViewMode = 'categories' | 'list'

const route = useRoute()
const router = useRouter()

const categoryStore = useHouseholdCategories()
const objectStore = useHouseholdObjects()
const { categories } = categoryStore
const { objects, uncategorizedCount, countFor } = objectStore

/** The view mode lives in the URL (?view=list) so back navigation keeps it. */
const viewMode = computed<InventoryViewMode>({
  get: () => (route.query.view === 'list' ? 'list' : 'categories'),
  set: (mode) => {
    void router.replace({ query: { ...route.query, view: mode === 'list' ? 'list' : undefined } })
  },
})

const isLoading = computed<boolean>(
  () => categoryStore.isLoading.value || objectStore.isLoading.value,
)
const loadError = computed<string | null>(
  () => categoryStore.error.value ?? objectStore.error.value,
)

const isCategoryDialogOpen = ref(false)
/** null = create mode, otherwise the category being edited. */
const categoryToEdit = ref<HouseholdCategory | null>(null)
const isDeleteCategoryDialogOpen = ref(false)
const categoryToDelete = ref<HouseholdCategory | null>(null)
const objectPanel = ref<InstanceType<typeof HouseholdObjectPanel> | null>(null)

function openAddCategory(): void {
  categoryToEdit.value = null
  isCategoryDialogOpen.value = true
}

function openEditCategory(category: HouseholdCategory): void {
  categoryToEdit.value = category
  isCategoryDialogOpen.value = true
}

function openDeleteCategory(category: HouseholdCategory): void {
  categoryToDelete.value = category
  isDeleteCategoryDialogOpen.value = true
}

function openAddObject(): void {
  objectPanel.value?.openCreateDialog()
}

function retry(): void {
  void Promise.all([categoryStore.refresh(), objectStore.refresh()])
}

onMounted(() => {
  void Promise.all([categoryStore.ensureLoaded(), objectStore.ensureLoaded()])
})
</script>

<template>
  <div>
    <PageHeader
      title="Inventory"
      subtitle="Keep track of your household objects, warranties and maintenance"
    >
      <template #actions>
        <v-btn-toggle
          v-model="viewMode"
          mandatory
          density="comfortable"
          variant="outlined"
          divided
          rounded="lg"
          color="primary"
        >
          <v-btn value="categories" prepend-icon="mdi-view-grid-outline">By category</v-btn>
          <v-btn value="list" prepend-icon="mdi-format-list-bulleted">List</v-btn>
        </v-btn-toggle>
        <v-btn
          v-if="viewMode === 'categories'"
          color="primary"
          variant="flat"
          size="large"
          prepend-icon="mdi-plus"
          v-bind="{ onClick: openAddCategory }"
        >
          Add category
        </v-btn>
        <v-btn
          v-else
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

    <template v-if="viewMode === 'categories'">
      <div v-if="isLoading && categories.length === 0" class="category-grid">
        <v-skeleton-loader v-for="n in 4" :key="n" type="card" height="140" />
      </div>

      <v-card v-else-if="categories.length === 0 && uncategorizedCount === 0">
        <EmptyState
          icon="mdi-shape-outline"
          title="No categories yet"
          text="Create categories such as Heating, Energy or Appliances to organise your household objects. You can also add objects without a category in the List view."
        >
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-plus"
            class="mt-4"
            v-bind="{ onClick: openAddCategory }"
          >
            Add category
          </v-btn>
        </EmptyState>
      </v-card>

      <div v-else class="category-grid">
        <CategoryTile
          v-for="category in categories"
          :key="category.id"
          :title="category.name"
          :icon="category.icon"
          :description="category.description"
          :count="countFor(category.id)"
          :to="{ name: 'inventory-category', params: { categoryId: String(category.id) } }"
          show-actions
          @edit="openEditCategory(category)"
          @delete="openDeleteCategory(category)"
        />
        <CategoryTile
          v-if="uncategorizedCount > 0"
          :title="UNCATEGORIZED_LABEL"
          :icon="UNCATEGORIZED_ICON"
          :count="uncategorizedCount"
          :to="{ name: 'inventory-category', params: { categoryId: 'none' } }"
          muted
        />
      </div>
    </template>

    <HouseholdObjectPanel
      v-else
      ref="objectPanel"
      :objects="objects"
      :loading="isLoading"
      title="All objects"
      show-category
      empty-title="No objects yet"
      empty-text="Add your first household object, e.g. a heat pump, a washing machine or a solar inverter."
    />

    <CategoryFormDialog v-model="isCategoryDialogOpen" :category="categoryToEdit" />
    <DeleteCategoryDialog
      v-model="isDeleteCategoryDialogOpen"
      :category="categoryToDelete"
      :object-count="categoryToDelete ? countFor(categoryToDelete.id) : 0"
    />
  </div>
</template>

<style scoped>
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
</style>
