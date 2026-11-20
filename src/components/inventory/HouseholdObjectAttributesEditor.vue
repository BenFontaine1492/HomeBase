<script setup lang="ts">
import { computed } from 'vue'
import DateField from '@/components/common/DateField.vue'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { t } from '@/i18n'
import {
  ATTRIBUTE_VALUE_TYPES,
  attributeValueTypeLabel,
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

const typeOptions = computed(() =>
  ATTRIBUTE_VALUE_TYPES.map((value) => ({ title: attributeValueTypeLabel(value), value })),
)

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
  required: (value: string): true | string => value.trim().length > 0 || t('common.required'),
  unique: (value: string): true | string =>
    rows.value.filter((row) => row.name.trim().toLowerCase() === value.trim().toLowerCase()).length < 2 ||
    t('attributes.editor.alreadyUsed'),
  number: (value: string): true | string =>
    value.trim() === '' ||
    HouseholdObjectAttributeValues.normaliseNumber(value) !== null ||
    t('attributes.editor.enterNumber'),
}
</script>

<template>
  <section>
    <h3 class="hb-body-strong">{{ t('attributes.editor.title') }}</h3>
    <p class="hb-caption text-medium-emphasis mb-4">{{ t('attributes.editor.hint') }}</p>

    <div v-for="(row, index) in rows" :key="row.key" class="attribute-row">
      <v-combobox
        :model-value="row.name"
        :items="nameSuggestions"
        :label="t('common.nameRequired')"
        :rules="[rules.required, rules.unique]"
        hide-no-data
        class="attribute-row__name"
        @update:model-value="(name: string | null) => (row.name = name ?? '')"
      />
      <v-select
        :model-value="row.valueType"
        :items="typeOptions"
        :label="t('common.type')"
        class="attribute-row__type"
        @update:model-value="(type: AttributeValueType) => changeType(row, type)"
      />
      <!-- A checkbox, not a switch: the value is only saved with the form. -->
      <v-checkbox
        v-if="row.valueType === 'boolean'"
        :model-value="row.value === '1'"
        :label="t('common.yes')"
        hide-details
        class="attribute-row__value"
        @update:model-value="(checked: boolean | null) => (row.value = checked === true ? '1' : '0')"
      />
      <v-text-field
        v-else-if="row.valueType === 'number'"
        v-model="row.value"
        :label="t('common.value')"
        :placeholder="t('attributes.editor.numberPlaceholder')"
        v-bind="{ inputmode: 'decimal' }"
        :rules="[rules.number]"
        class="attribute-row__value"
      />
      <DateField
        v-else-if="row.valueType === 'date'"
        v-model="row.value"
        :label="t('common.value')"
        class="attribute-row__value"
      />
      <v-text-field v-else v-model="row.value" :label="t('common.value')" class="attribute-row__value" />
      <v-text-field
        v-if="row.valueType === 'number'"
        v-model="row.unit"
        :label="t('common.unit')"
        placeholder="kW"
        class="attribute-row__unit"
      />
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        class="attribute-row__remove"
        v-bind="{
          onClick: () => removeRow(index),
          'aria-label': t('attributes.editor.remove', { name: row.name }).trim(),
        }"
      />
    </div>

    <v-btn size="small" prepend-icon="mdi-plus" v-bind="{ onClick: addRow }">{{ t('attributes.editor.add') }}</v-btn>
  </section>
</template>

<style scoped>
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

.attribute-row__unit {
  flex: 0 0 96px;
}

/* Centred on the 40 px fields: (40 - 32) / 2. */
.attribute-row__remove {
  margin-top: 4px;
}
</style>
