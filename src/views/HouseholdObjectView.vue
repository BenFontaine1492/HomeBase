<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import DeleteHouseholdObjectDialog from '@/components/inventory/DeleteHouseholdObjectDialog.vue'
import HouseholdObjectFormDialog from '@/components/inventory/HouseholdObjectFormDialog.vue'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { UNCATEGORIZED_ICON, UNCATEGORIZED_LABEL } from '@/types/household-category'
import { formatAttributeValue } from '@/utils/attribute-value'
import { formatCents } from '@/utils/currency'
import { formatDate } from '@/utils/date'

/**
 * The page of one household object: its fixed fields and its own attributes.
 * Documents and maintenance will be added as further sections (tabs).
 */
const props = defineProps<{
  /** Route param: the object id. */
  objectId: string
}>()

const router = useRouter()
const objectStore = useHouseholdObjects()
const categoryStore = useHouseholdCategories()

const object = computed(() => {
  const id = Number(props.objectId)
  return Number.isSafeInteger(id) ? objectStore.findObject(id) : undefined
})
const category = computed(() => (object.value ? categoryStore.findCategory(object.value.categoryId) : undefined))
const attributes = computed(() => (object.value ? objectStore.attributesOf(object.value.id) : []))

const isLoading = computed<boolean>(() => categoryStore.isLoading.value || objectStore.isLoading.value)
const loadError = computed<string | null>(() => categoryStore.error.value ?? objectStore.error.value)

const fields = computed<{ label: string; value: string | null }[]>(() => {
  const current = object.value
  if (!current) return []
  return [
    { label: 'Manufacturer', value: current.manufacturer },
    { label: 'Model', value: current.model },
    { label: 'Serial number', value: current.serialNumber },
    { label: 'Location / room', value: current.location },
    { label: 'Purchase date', value: current.purchaseDate && formatDate(current.purchaseDate) },
    {
      label: 'Purchase price',
      value: current.purchasePriceCents === null ? null : formatCents(current.purchasePriceCents),
    },
    { label: 'Installation date', value: current.installationDate && formatDate(current.installationDate) },
  ]
})

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

      <v-chip
        :prepend-icon="category?.icon ?? UNCATEGORIZED_ICON"
        size="small"
        variant="tonal"
        :color="category ? 'primary' : undefined"
        class="mb-6"
      >
        {{ category?.name ?? UNCATEGORIZED_LABEL }}
      </v-chip>

      <v-card class="mb-6">
        <div class="section__title">Details</div>
        <v-divider />
        <div class="section__body">
          <dl class="detail__grid">
            <template v-for="field in fields" :key="field.label">
              <dt>{{ field.label }}</dt>
              <dd :class="{ detail__empty: !field.value }">{{ field.value || '—' }}</dd>
            </template>
          </dl>
          <div v-if="object.notes" class="detail__notes">
            <div class="detail__notes-label">Notes</div>
            <p>{{ object.notes }}</p>
          </div>
        </div>
      </v-card>

      <v-card>
        <div class="section__title">Attributes</div>
        <v-divider />
        <div class="section__body">
          <dl v-if="attributes.length > 0" class="detail__grid">
            <template v-for="attribute in attributes" :key="attribute.id">
              <dt>{{ attribute.name }}</dt>
              <dd :class="{ detail__empty: attribute.value === null }">
                {{ formatAttributeValue(attribute) ?? '—' }}
              </dd>
            </template>
          </dl>
          <p v-else class="detail__empty-text">
            No attributes yet. Use <strong>Edit</strong> to add your own fields, e.g. power or filter type.
          </p>
        </div>
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

.section__title {
  padding: 20px 24px;
  font-size: 1rem;
  font-weight: 600;
}

.section__body {
  padding: 20px 24px;
}

.detail__grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 10px 32px;
  margin: 0;
}

.detail__grid dt {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.detail__grid dd {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.detail__empty {
  color: rgba(var(--v-theme-on-surface), 0.35);
}

.detail__empty-text {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.detail__notes {
  margin-top: 20px;
}

.detail__notes-label {
  margin-bottom: 4px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.detail__notes p {
  font-size: 0.875rem;
  white-space: pre-wrap;
}
</style>
