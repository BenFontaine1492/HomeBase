<script setup lang="ts">
import { computed } from 'vue'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import {
  ATTRIBUTE_VALUE_TYPES,
  ATTRIBUTE_VALUE_TYPE_LABELS,
  HouseholdObjectAttributeValues,
  type AttributeValueType,
  type HouseholdObjectAttributeDraft,
} from '@/types/household-object-attribute'

/**
 * Editable list of an object's own attributes (name · type · value · unit),
 * part of the object form. Field rules feed into the surrounding v-form.
 */
const rows = defineModel<HouseholdObjectAttributeDraft[]>({ required: true })

const { attributeNames } = useHouseholdObjects()

const typeOptions = ATTRIBUTE_VALUE_TYPES.map((value) => ({ title: ATTRIBUTE_VALUE_TYPE_LABELS[value], value }))

/** Names already used elsewhere, minus the ones already in this list. */
const nameSuggestions = computed<string[]>(() => {
  const used = new Set(rows.value.map((row) => row.name.trim().toLowerCase()))
  return attributeNames.value.filter((name) => !used.has(name.toLowerCase()))
})

function emptyValue(valueType: AttributeValueType): string {
  return valueType === 'boolean' ? '0' : ''
}

function addRow(): void {
  const key = Math.max(-1, ...rows.value.map((row) => row.key)) + 1
  rows.value.push({ key, name: '', valueType: 'text', value: '', unit: '' })
}

function removeRow(index: number): void {
  rows.value.splice(index, 1)
}

/** Text and numbers keep what was typed; any other change starts with an empty value. */
function changeType(row: HouseholdObjectAttributeDraft, valueType: AttributeValueType): void {
  const keepsValue = [row.valueType, valueType].every((type) => type === 'text' || type === 'number')
  if (!keepsValue) row.value = emptyValue(valueType)
  row.valueType = valueType
}

const rules = {
  required: (value: string): true | string => value.trim().length > 0 || 'Required',
  unique: (value: string): true | string =>
    rows.value.filter((row) => row.name.trim().toLowerCase() === value.trim().toLowerCase()).length < 2 ||
    'Already used',
  number: (value: string): true | string =>
    value.trim() === '' || HouseholdObjectAttributeValues.normaliseNumber(value) !== null || 'Enter a number',
}
</script>

<template>
  <section class="attributes">
    <div class="attributes__title">Additional attributes</div>
    <div class="attributes__hint">Your own fields for this object, e.g. power, refrigerant or filter type.</div>

    <div v-for="(row, index) in rows" :key="row.key" class="attribute-row">
      <v-combobox
        :model-value="row.name"
        :items="nameSuggestions"
        label="Name *"
        :rules="[rules.required, rules.unique]"
        hide-no-data
        class="attribute-row__name"
        @update:model-value="(name: string | null) => (row.name = name ?? '')"
      />
      <v-select
        :model-value="row.valueType"
        :items="typeOptions"
        label="Type"
        class="attribute-row__type"
        @update:model-value="(type: AttributeValueType) => changeType(row, type)"
      />
      <div v-if="row.valueType === 'boolean'" class="attribute-row__value attribute-row__switch">
        <v-switch
          :model-value="row.value"
          true-value="1"
          false-value="0"
          @update:model-value="(value: string | null) => (row.value = value === '1' ? '1' : '0')"
          :label="row.value === '1' ? 'Yes' : 'No'"
          color="primary"
          inset
          hide-details
        />
      </div>
      <v-text-field
        v-else-if="row.valueType === 'number'"
        v-model="row.value"
        label="Value"
        placeholder="e.g. 12,5"
        v-bind="{ inputmode: 'decimal' }"
        :rules="[rules.number]"
        class="attribute-row__value"
      />
      <v-text-field
        v-else
        v-model="row.value"
        label="Value"
        :type="row.valueType === 'date' ? 'date' : 'text'"
        class="attribute-row__value"
      />
      <v-text-field
        v-if="row.valueType === 'number'"
        v-model="row.unit"
        label="Unit"
        placeholder="kW"
        class="attribute-row__unit"
      />
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        class="attribute-row__remove"
        v-bind="{ onClick: () => removeRow(index), 'aria-label': `Remove attribute ${row.name}`.trim() }"
      />
    </div>

    <v-btn variant="tonal" prepend-icon="mdi-plus" class="mb-6" v-bind="{ onClick: addRow }">
      Add attribute
    </v-btn>
  </section>
</template>

<style scoped>
.attributes__title {
  font-size: 0.9375rem;
  font-weight: 600;
}

.attributes__hint {
  margin-bottom: 16px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.attribute-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.attribute-row__name {
  flex: 2 1 0;
}

.attribute-row__type {
  flex: 0 0 130px;
}

.attribute-row__value {
  flex: 2 1 0;
}

.attribute-row__switch {
  min-height: 56px;
  display: flex;
  align-items: center;
}

.attribute-row__unit {
  flex: 0 0 90px;
}

.attribute-row__remove {
  margin-top: 10px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
</style>
