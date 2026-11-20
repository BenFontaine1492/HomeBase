<script setup lang="ts">
import { computed } from 'vue'
import ListSection from '@/components/common/ListSection.vue'
import { t } from '@/i18n'
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
    { label: t('objects.fields.manufacturer'), value: current.manufacturer },
    { label: t('objects.fields.model'), value: current.model },
    { label: t('objects.fields.serialNumber'), value: current.serialNumber },
    { label: t('objects.fields.location'), value: current.location },
    { label: t('objects.fields.purchaseDate'), value: current.purchaseDate && formatDate(current.purchaseDate) },
    {
      label: t('objects.fields.purchasePrice'),
      value: current.purchasePriceCents === null ? null : formatCents(current.purchasePriceCents),
    },
    {
      label: t('objects.fields.installationDate'),
      value: current.installationDate && formatDate(current.installationDate),
    },
  ]
})
</script>

<template>
  <div class="hb-sections">
    <ListSection :title="t('objects.details.details')">
      <v-card class="details__card">
        <dl class="details__grid">
          <template v-for="field in fields" :key="field.label">
            <dt class="hb-caption text-medium-emphasis">{{ field.label }}</dt>
            <dd :class="{ 'text-disabled': !field.value }">{{ field.value || '—' }}</dd>
          </template>
        </dl>
        <div v-if="object.notes" class="details__notes">
          <div class="hb-caption text-medium-emphasis">{{ t('common.notes') }}</div>
          <p class="details__notes-text">{{ object.notes }}</p>
        </div>
      </v-card>
    </ListSection>

    <ListSection :title="t('objects.details.attributes')" :count="attributes.length">
      <v-card class="details__card">
        <dl v-if="attributes.length > 0" class="details__grid">
          <template v-for="attribute in attributes" :key="attribute.id">
            <dt class="hb-caption text-medium-emphasis">{{ attribute.name }}</dt>
            <dd :class="{ 'text-disabled': attribute.value === null }">
              {{ formatAttributeValue(attribute) ?? '—' }}
            </dd>
          </template>
        </dl>
        <p v-else class="text-medium-emphasis">{{ t('objects.details.noAttributes') }}</p>
      </v-card>
    </ListSection>
  </div>
</template>

<style scoped>
.details__card {
  padding: 16px;
}

.details__grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 32px;
  align-items: baseline;
  margin: 0;
}

.details__grid dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.details__notes {
  margin-top: 24px;
}

.details__notes-text {
  margin-top: 4px;
  white-space: pre-wrap;
}
</style>
