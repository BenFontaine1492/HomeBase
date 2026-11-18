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
import { useMaintenance } from '@/composables/useMaintenance'
import { t } from '@/i18n'
import { UNCATEGORIZED_ICON, uncategorizedLabel, type HouseholdCategory } from '@/types/household-category'

type InventoryViewMode = 'categories' | 'list'

const route = useRoute()
const router = useRouter()

const categoryStore = useHouseholdCategories()
const objectStore = useHouseholdObjects()
const maintenanceStore = useMaintenance()
const { categories } = categoryStore
const { objects, uncategorizedCount, countFor } = objectStore

/** The view mode lives in the URL (?view=list) so back navigation keeps it. */
const viewMode = computed<InventoryViewMode>({
  get: () => (route.query.view === 'list' ? 'list' : 'categories'),
  set: (mode) => {
    void router.replace({ query: { ...route.query, view: mode === 'list' ? 'list' : undefined } })
  },
})

const isLoading = computed<boolean>(() => categoryStore.isLoading.value || objectStore.isLoading.value)
const loadError = computed<string | null>(() => categoryStore.error.value ?? objectStore.error.value)

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
  void Promise.all([categoryStore.ensureLoaded(), objectStore.ensureLoaded(), maintenanceStore.ensureLoaded()])
})
</script>

<template>
  <div>
    <PageHeader :title="t('nav.inventory')" :subtitle="t('inventory.subtitle')">
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
          <v-btn value="categories" prepend-icon="mdi-view-grid-outline">{{ t('inventory.byCategory') }}</v-btn>
          <v-btn value="list" prepend-icon="mdi-format-list-bulleted">{{ t('inventory.list') }}</v-btn>
        </v-btn-toggle>
        <v-btn
          v-if="viewMode === 'categories'"
          color="primary"
          variant="flat"
          size="large"
          prepend-icon="mdi-plus"
          v-bind="{ onClick: openAddCategory }"
        >
          {{ t('inventory.categoryForm.addTitle') }}
        </v-btn>
        <v-btn
          v-else
          color="primary"
          variant="flat"
          size="large"
          prepend-icon="mdi-plus"
          v-bind="{ onClick: openAddObject }"
        >
          {{ t('objects.add') }}
        </v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="loadError" type="error" class="mb-6" :title="t('inventory.loadError')">
      {{ loadError }}
      <template #append>
        <v-btn variant="text" size="small" v-bind="{ onClick: retry }">{{ t('common.retry') }}</v-btn>
      </template>
    </v-alert>

    <template v-if="viewMode === 'categories'">
      <div v-if="isLoading && categories.length === 0" class="category-grid">
        <v-skeleton-loader v-for="n in 4" :key="n" type="card" height="140" />
      </div>

      <v-card v-else-if="categories.length === 0 && uncategorizedCount === 0">
        <EmptyState
          icon="mdi-shape-outline"
          :title="t('inventory.noCategoriesTitle')"
          :text="t('inventory.noCategoriesText')"
        >
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-plus"
            class="mt-4"
            v-bind="{ onClick: openAddCategory }"
          >
            {{ t('inventory.categoryForm.addTitle') }}
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
          :maintenance="maintenanceStore.summaryOf(objectStore.objectsInCategory(category.id))"
          :to="{ name: 'inventory-category', params: { categoryId: String(category.id) } }"
          show-actions
          @edit="openEditCategory(category)"
          @delete="openDeleteCategory(category)"
        />
        <CategoryTile
          v-if="uncategorizedCount > 0"
          :title="uncategorizedLabel()"
          :icon="UNCATEGORIZED_ICON"
          :count="uncategorizedCount"
          :maintenance="maintenanceStore.summaryOf(objectStore.objectsInCategory(null))"
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
      :title="t('inventory.allObjects')"
      show-category
      :empty-title="t('inventory.noObjectsTitle')"
      :empty-text="t('inventory.noObjectsText')"
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
