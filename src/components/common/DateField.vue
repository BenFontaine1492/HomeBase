<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import { dateOfIso, isoDateOf } from '@/utils/date'

/**
 * A date field with Vuetify's date picker. Dates are typed in the order of the date format
 * chosen in Settings → General (App.vue sets the picker's locale). The value is a
 * 'YYYY-MM-DD' string, '' when empty, as the forms and the database keep dates.
 */
const props = defineProps<{
  label: string
  /** Shows "Required" when empty; otherwise the field can be cleared. */
  required?: boolean
  hint?: string
  disabled?: boolean
}>()

const model = defineModel<string>({ required: true })

const date = computed<Date | null>(() => dateOfIso(model.value))

/** The picker's rules get its date (null when empty or not a valid date). */
const rules = computed(() =>
  props.required ? [(value: unknown) => value instanceof Date || t('common.required')] : [],
)

function update(value: unknown): void {
  model.value = value instanceof Date ? isoDateOf(value) : ''
}
</script>

<template>
  <v-date-input
    :model-value="date"
    :label="label"
    :rules="rules"
    :hint="hint"
    :disabled="disabled"
    :persistent-hint="hint !== undefined"
    :clearable="!required"
    prepend-icon=""
    append-inner-icon="mdi-calendar-blank-outline"
    hide-actions
    @update:model-value="update"
  />
</template>
