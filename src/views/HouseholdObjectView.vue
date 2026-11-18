<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import AttachmentList from '@/components/attachments/AttachmentList.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import DeleteHouseholdObjectDialog from '@/components/inventory/DeleteHouseholdObjectDialog.vue'
import HouseholdObjectDetails from '@/components/inventory/HouseholdObjectDetails.vue'
import HouseholdObjectFormDialog from '@/components/inventory/HouseholdObjectFormDialog.vue'
import MaintenancePanel from '@/components/maintenance/MaintenancePanel.vue'
import MaintenanceStatusChip from '@/components/maintenance/MaintenanceStatusChip.vue'
import { useAttachments } from '@/composables/useAttachments'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { useMaintenance } from '@/composables/useMaintenance'
import { UNCATEGORIZED_ICON, UNCATEGORIZED_LABEL } from '@/types/household-category'

/** The page of one household object: Overview (details, attributes), Documents and Maintenance tabs. */
const props = defineProps<{
  /** Route param: the object id. */
  objectId: string
}>()

const OBJECT_TABS = ['overview', 'documents', 'maintenance'] as const
type ObjectTab = (typeof OBJECT_TABS)[number]

const route = useRoute()
const router = useRouter()
const objectStore = useHouseholdObjects()
const categoryStore = useHouseholdCategories()
const attachmentStore = useAttachments()
const maintenanceStore = useMaintenance()

const object = computed(() => {
  const id = Number(props.objectId)
  return Number.isSafeInteger(id) ? objectStore.findObject(id) : undefined
})
const category = computed(() => (object.value ? categoryStore.findCategory(object.value.categoryId) : undefined))
const attributes = computed(() => (object.value ? objectStore.attributesOf(object.value.id) : []))
const documentCount = computed<number>(() =>
  object.value ? attachmentStore.attachmentsOf({ kind: 'object', id: object.value.id }).length : 0,
)
const maintenanceSummary = computed(() => (object.value ? maintenanceStore.summaryOf([object.value]) : null))

/** The tab lives in the URL (?tab=documents), so back navigation keeps it. */
const tab = computed<ObjectTab>({
  get: () => OBJECT_TABS.find((name) => name === route.query.tab) ?? 'overview',
  set: (name) => {
    void router.replace({ query: { ...route.query, tab: name === 'overview' ? undefined : name } })
  },
})

const isLoading = computed<boolean>(() => categoryStore.isLoading.value || objectStore.isLoading.value)
const loadError = computed<string | null>(() => categoryStore.error.value ?? objectStore.error.value)

/** The category page the object belongs to; kept after the object is deleted. */
const backRoute = ref<RouteLocationRaw>({ name: 'inventory' })
const backLabel = ref('Inventory')
watch(
  [object, category],
  () => {
    if (!object.value) return
    backRoute.value = {
      name: 'inventory-category',
      params: { categoryId: String(object.value.categoryId ?? 'none') },
    }
    backLabel.value = category.value?.name ?? UNCATEGORIZED_LABEL
  },
  { immediate: true },
)

const hasLoaded = ref(false)
const isFormDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)

// Unknown or deleted object → back to where it was listed (once the data is loaded).
watch([hasLoaded, object], () => {
  if (hasLoaded.value && !loadError.value && !object.value) void router.replace(backRoute.value)
})

function retry(): void {
  void Promise.all([categoryStore.refresh(), objectStore.refresh()])
}

onMounted(async () => {
  void Promise.all([attachmentStore.ensureLoaded(), maintenanceStore.ensureLoaded()])
  await Promise.all([categoryStore.ensureLoaded(), objectStore.ensureLoaded()])
  hasLoaded.value = true
})
</script>

<template>
  <div class="object-page">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="back-link mb-4" :to="backRoute">
      {{ backLabel }}
    </v-btn>

    <v-alert v-if="loadError" type="error" class="mb-6" title="Could not load the object">
      {{ loadError }}
      <template #append>
        <v-btn variant="text" size="small" v-bind="{ onClick: retry }">Retry</v-btn>
      </template>
    </v-alert>

    <v-skeleton-loader v-if="!object && isLoading" type="heading, card" />

    <template v-else-if="object">
      <PageHeader :title="object.name">
        <template #actions>
          <v-btn
            color="error"
            variant="text"
            size="large"
            prepend-icon="mdi-trash-can-outline"
            v-bind="{ onClick: () => (isDeleteDialogOpen = true) }"
          >
            Delete
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            size="large"
            prepend-icon="mdi-pencil-outline"
            v-bind="{ onClick: () => (isFormDialogOpen = true) }"
          >
            Edit
          </v-btn>
        </template>
      </PageHeader>

      <div class="object-page__chips mb-6">
        <v-chip
          :prepend-icon="category?.icon ?? UNCATEGORIZED_ICON"
          size="small"
          variant="tonal"
          :color="category ? 'primary' : undefined"
        >
          {{ category?.name ?? UNCATEGORIZED_LABEL }}
        </v-chip>
        <MaintenanceStatusChip v-if="maintenanceSummary" :summary="maintenanceSummary" />
      </div>

      <v-card>
        <v-tabs v-model="tab" color="primary" class="px-2">
          <v-tab value="overview" prepend-icon="mdi-information-outline">Overview</v-tab>
          <v-tab value="documents" prepend-icon="mdi-file-document-multiple-outline">
            Documents
            <span v-if="documentCount > 0" class="object-page__count">{{ documentCount }}</span>
          </v-tab>
          <v-tab value="maintenance" prepend-icon="mdi-wrench-clock">Maintenance</v-tab>
        </v-tabs>
        <v-divider />
        <v-window v-model="tab">
          <v-window-item value="overview">
            <HouseholdObjectDetails :object="object" :attributes="attributes" />
          </v-window-item>
          <v-window-item value="documents">
            <AttachmentList
              :owner="{ kind: 'object', id: object.id }"
              empty-title="No documents yet"
              empty-text="Keep invoices, contracts, manuals, warranty certificates and photos of this object here."
            />
          </v-window-item>
          <v-window-item value="maintenance">
            <MaintenancePanel :object="object" />
          </v-window-item>
        </v-window>
      </v-card>

      <HouseholdObjectFormDialog v-model="isFormDialogOpen" :object="object" />
      <DeleteHouseholdObjectDialog v-model="isDeleteDialogOpen" :object="object" />
    </template>
  </div>
</template>

<style scoped>
.object-page {
  max-width: 880px;
}

.back-link {
  margin-left: -12px;
}

.object-page__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.object-page__count {
  margin-left: 6px;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
