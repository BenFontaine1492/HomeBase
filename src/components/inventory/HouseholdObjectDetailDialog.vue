<script setup lang="ts">
import { computed } from 'vue'
import type { HouseholdObject } from '@/types/household-object'
import { UNCATEGORIZED_ICON, UNCATEGORIZED_LABEL } from '@/types/household-category'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { formatCents } from '@/utils/currency'
import { formatDate } from '@/utils/date'

/** Read-only view of all fields of an object, with shortcuts to edit or delete it. */
const props = defineProps<{
  object: HouseholdObject | null
}>()

defineEmits<{
  edit: [object: HouseholdObject]
  delete: [object: HouseholdObject]
}>()

const open = defineModel<boolean>({ required: true })

const { findCategory } = useHouseholdCategories()

const category = computed(() => (props.object ? findCategory(props.object.categoryId) : undefined))

const fields = computed<{ label: string; value: string | null }[]>(() => {
  const object = props.object
  if (!object) return []
  return [
    { label: 'Manufacturer', value: object.manufacturer },
    { label: 'Model', value: object.model },
    { label: 'Serial number', value: object.serialNumber },
    { label: 'Location / room', value: object.location },
    { label: 'Purchase date', value: object.purchaseDate && formatDate(object.purchaseDate) },
    {
      label: 'Purchase price',
      value: object.purchasePriceCents === null ? null : formatCents(object.purchasePriceCents),
    },
    { label: 'Installation date', value: object.installationDate && formatDate(object.installationDate) },
  ]
})
</script>

<template>
  <v-dialog v-model="open" max-width="560" scrollable>
    <v-card v-if="object" class="pa-2">
      <v-card-title class="text-title-large font-weight-bold pt-4 px-6 detail__title">
        {{ object.name }}
      </v-card-title>
      <div class="px-6">
        <v-chip
          :prepend-icon="category?.icon ?? UNCATEGORIZED_ICON"
          size="small"
          variant="tonal"
          :color="category ? 'primary' : undefined"
        >
          {{ category?.name ?? UNCATEGORIZED_LABEL }}
        </v-chip>
      </div>

      <v-card-text class="px-6">
        <dl class="detail__grid">
          <template v-for="field in fields" :key="field.label">
            <dt>{{ field.label }}</dt>
            <dd :class="{ 'detail__empty': !field.value }">{{ field.value || '—' }}</dd>
          </template>
        </dl>
        <div v-if="object.notes" class="detail__notes">
          <div class="detail__notes-label">Notes</div>
          <p>{{ object.notes }}</p>
        </div>
      </v-card-text>

      <v-card-actions class="px-6 pb-4">
        <v-btn
          color="error"
          variant="text"
          prepend-icon="mdi-trash-can-outline"
          v-bind="{ onClick: () => $emit('delete', object!) }"
        >
          Delete
        </v-btn>
        <v-spacer />
        <v-btn variant="text" v-bind="{ onClick: () => (open = false) }">Close</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-pencil-outline"
          v-bind="{ onClick: () => $emit('edit', object!) }"
        >
          Edit
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.detail__title {
  white-space: normal;
}

.detail__grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 10px 24px;
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
