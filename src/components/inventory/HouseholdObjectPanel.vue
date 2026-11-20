<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import DeleteHouseholdObjectDialog from './DeleteHouseholdObjectDialog.vue'
import HouseholdObjectFormDialog from './HouseholdObjectFormDialog.vue'
import HouseholdObjectListItem from './HouseholdObjectListItem.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ListSection from '@/components/common/ListSection.vue'
import { useAttachments } from '@/composables/useAttachments'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useMaintenance } from '@/composables/useMaintenance'
import { t } from '@/i18n'
import { UNCATEGORIZED_ICON, uncategorizedLabel } from '@/types/household-category'
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
  /** Show a category badge on each item (List view). */
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
const maintenance = useMaintenance()
const attachments = useAttachments()

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
  return findCategory(object.categoryId)?.name ?? uncategorizedLabel()
}

function categoryIcon(object: HouseholdObject): string | undefined {
  if (!props.showCategory) return undefined
  return findCategory(object.categoryId)?.icon ?? UNCATEGORIZED_ICON
}

// Maintenance for the status badges; documents for the counts in the delete dialog.
onMounted(() => {
  void Promise.all([maintenance.ensureLoaded(), attachments.ensureLoaded()])
})

defineExpose({ openCreateDialog })
</script>

<template>
  <ListSection :title="title" :count="objects.length">
    <v-card v-if="loading && objects.length === 0" class="pa-4">
      <v-skeleton-loader v-for="n in 3" :key="n" type="list-item-two-line" />
    </v-card>
    <v-card v-else-if="objects.length === 0">
      <EmptyState icon="mdi-package-variant-closed" :title="emptyTitle" :text="emptyText">
        <v-btn prepend-icon="mdi-plus" v-bind="{ onClick: openCreateDialog }">{{ t('objects.add') }}</v-btn>
      </EmptyState>
    </v-card>
    <HouseholdObjectListItem
      v-for="object in objects"
      :key="object.id"
      :object="object"
      :category-name="categoryName(object)"
      :category-icon="categoryIcon(object)"
      :maintenance="maintenance.summaryOf([object])"
      @open="openObjectPage"
      @edit="openEditDialog"
      @delete="openDeleteDialog"
    />
  </ListSection>

  <HouseholdObjectFormDialog
    v-model="isFormDialogOpen"
    :object="objectToEdit"
    :default-category-id="defaultCategoryId"
    :lock-category="lockCategory"
  />
  <DeleteHouseholdObjectDialog v-model="isDeleteDialogOpen" :object="objectToDelete" />
</template>
