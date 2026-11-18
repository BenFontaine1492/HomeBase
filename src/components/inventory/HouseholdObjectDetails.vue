<script setup lang="ts">
import { computed } from 'vue'
import type { HouseholdObject } from '@/types/household-object'
import type { HouseholdObjectAttribute } from '@/types/household-object-attribute'
import { formatAttributeValue } from '@/utils/attribute-value'
import { formatCents } from '@/utils/currency'
import { formatDate } from '@/utils/date'

/** The Overview tab of an object page: its fixed fields and its own attributes. */
const props = defineProps<{
  object: HouseholdObject
  attributes: readonly HouseholdObjectAttribute[]
}>()

const fields = computed<{ label: string; value: string | null }[]>(() => {
  const current = props.object
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
</script>

<template>
  <div>
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

    <v-divider />
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
  </div>
</template>

<style scoped>
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
