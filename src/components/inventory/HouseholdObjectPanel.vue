<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import DeleteHouseholdObjectDialog from './DeleteHouseholdObjectDialog.vue'
import HouseholdObjectFormDialog from './HouseholdObjectFormDialog.vue'
import HouseholdObjectListItem from './HouseholdObjectListItem.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { UNCATEGORIZED_ICON, UNCATEGORIZED_LABEL } from '@/types/household-category'
import type { HouseholdObject } from '@/types/household-object'

/**
 * Object list plus its create / edit / delete dialogs. Clicking an object opens its page.
 * Used by the inventory List view and the category page. The parent opens the
 * create dialog through the exposed `openCreateDialog()`.
 */
const props = defineProps<{
  objects: readonly HouseholdObject[]
  loading: boolean
  title: string
  /** Show a category chip on each item (List view). */
  showCategory?: boolean
  /** Category preselected in the create dialog. */
  defaultCategoryId?: number | null
  /** Create dialog uses `defaultCategoryId` without showing the category field. */
  lockCategory?: boolean
  emptyTitle: string
  emptyText: string
}>()

const router = useRouter()
const { findCategory } = useHouseholdCategories()

const isFormDialogOpen = ref(false)
/** null = create mode, otherwise the object being edited. */
const objectToEdit = ref<HouseholdObject | null>(null)
const isDeleteDialogOpen = ref(false)
const objectToDelete = ref<HouseholdObject | null>(null)

function openCreateDialog(): void {
  objectToEdit.value = null
  isFormDialogOpen.value = true
}

function openObjectPage(object: HouseholdObject): void {
  void router.push({ name: 'inventory-object', params: { objectId: String(object.id) } })
}

function openEditDialog(object: HouseholdObject): void {
  objectToEdit.value = object
  isFormDialogOpen.value = true
}

function openDeleteDialog(object: HouseholdObject): void {
  objectToDelete.value = object
  isDeleteDialogOpen.value = true
}

function categoryName(object: HouseholdObject): string | undefined {
  if (!props.showCategory) return undefined
  return findCategory(object.categoryId)?.name ?? UNCATEGORIZED_LABEL
}

function categoryIcon(object: HouseholdObject): string | undefined {
  if (!props.showCategory) return undefined
  return findCategory(object.categoryId)?.icon ?? UNCATEGORIZED_ICON
}

defineExpose({ openCreateDialog })
</script>

<template>
  <v-card>
    <div class="object-panel__header">
      <div class="object-panel__title">{{ title }}</div>
      <div class="object-panel__count">{{ objects.length }} {{ objects.length === 1 ? 'object' : 'objects' }}</div>
    </div>

    <v-divider />

    <div v-if="loading && objects.length === 0" class="pa-6">
      <v-skeleton-loader v-for="n in 3" :key="n" type="list-item-two-line" />
    </div>

    <EmptyState
      v-else-if="objects.length === 0"
      icon="mdi-package-variant-closed"
      :title="emptyTitle"
      :text="emptyText"
    >
      <v-btn
        color="primary"
        variant="tonal"
        prepend-icon="mdi-plus"
        class="mt-4"
        v-bind="{ onClick: openCreateDialog }"
      >
        Add object
      </v-btn>
    </EmptyState>

    <template v-else>
      <template v-for="(object, index) in objects" :key="object.id">
        <v-divider v-if="index > 0" />
        <HouseholdObjectListItem
          :object="object"
          :category-name="categoryName(object)"
          :category-icon="categoryIcon(object)"
          @open="openObjectPage"
          @edit="openEditDialog"
          @delete="openDeleteDialog"
        />
      </template>
    </template>

    <HouseholdObjectFormDialog
      v-model="isFormDialogOpen"
      :object="objectToEdit"
      :default-category-id="defaultCategoryId"
      :lock-category="lockCategory"
    />
    <DeleteHouseholdObjectDialog v-model="isDeleteDialogOpen" :object="objectToDelete" />
  </v-card>
</template>

<style scoped>
.object-panel__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
}

.object-panel__title {
  font-size: 1rem;
  font-weight: 600;
}

.object-panel__count {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
