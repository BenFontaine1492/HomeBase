<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import DateField from '@/components/common/DateField.vue'
import CategoryField from '@/components/finances/CategoryField.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useCosts } from '@/composables/useCosts'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { useRecurringCosts } from '@/composables/useRecurringCosts'
import { t } from '@/i18n'
import { categorySuggestions } from '@/types/category'
import { defaultCostCategories, PAYMENT_METHODS, paymentMethodLabel, type PaymentMethod } from '@/types/cost'
import { INTERVAL_UNITS, MAX_INTERVAL_VALUE, type IntervalUnit } from '@/types/maintenance-task'
import { inputOfRule, type RecurringCost, type RecurringCostInput } from '@/types/recurring-cost'
import { centsToAmountInput, currencyCode, parseAmountToCents } from '@/utils/currency'
import { todayIsoDate } from '@/utils/date'

/** Creates a rule for a recurring cost, or edits `rule`. */
const props = defineProps<{
  rule?: RecurringCost | null
}>()

const open = defineModel<boolean>({ required: true })

const { costs, ensureLoaded: loadCosts } = useCosts()
const { rules: costRules, addRule, updateRule } = useRecurringCosts()
const { objects, ensureLoaded: loadObjects } = useHouseholdObjects()
const { isRunning: isSaving, error: submitError, run } = useAsyncAction()
const formId = useId()

/** v-select can't hold null as a value: "none" is 0 (ids start at 1) or 'none'. */
const NONE = 0
const NO_METHOD = 'none'

interface FormState {
  description: string
  amount: string
  intervalValue: string
  intervalUnit: IntervalUnit
  startDate: string
  endDate: string
  category: string
  payee: string
  paymentMethod: PaymentMethod | typeof NO_METHOD
  objectId: number
  autopay: boolean
  notes: string
}

/** A new rule: monthly, starting today. */
function newForm(): FormState {
  return {
    description: '',
    amount: '',
    intervalValue: '1',
    intervalUnit: 'month',
    startDate: todayIsoDate(),
    endDate: '',
    category: '',
    payee: '',
    paymentMethod: NO_METHOD,
    objectId: NONE,
    autopay: false,
    notes: '',
  }
}

/** The form for editing `rule`, or a new rule. */
function formFor(rule: RecurringCost | null | undefined): FormState {
  if (!rule) return newForm()
  const source = inputOfRule(rule)
  return {
    description: source.description,
    amount: centsToAmountInput(source.amountCents),
    intervalValue: String(source.intervalValue),
    intervalUnit: source.intervalUnit,
    startDate: source.startDate,
    endDate: source.endDate ?? '',
    category: source.category ?? '',
    payee: source.payee ?? '',
    paymentMethod: source.paymentMethod ?? NO_METHOD,
    objectId: source.householdObjectId ?? NONE,
    autopay: source.autopay,
    notes: source.notes ?? '',
  }
}

const form = reactive<FormState>(formFor(null))

const isEditMode = computed<boolean>(() => props.rule != null)

const unitOptions = computed(() =>
  INTERVAL_UNITS.map((unit) => ({ title: t(`costs.recurring.units.${unit}`), value: unit })),
)
/** The default categories, then those used before (like attribute names). */
const suggestions = computed<string[]>(() =>
  categorySuggestions(
    defaultCostCategories(),
    [...costs.value, ...costRules.value].map((entry) => entry.category),
  ),
)
const methodOptions = computed(() => [
  { title: t('costs.form.noPaymentMethod'), value: NO_METHOD },
  ...PAYMENT_METHODS.map((method) => ({ title: paymentMethodLabel(method), value: method })),
])
const objectOptions = computed(() => [
  { title: t('costs.form.noObject'), value: NONE },
  ...objects.value.map((object) => ({ title: object.name, value: object.id })),
])

const amountCents = computed<number | null>(() => parseAmountToCents(form.amount))
const intervalValue = computed<number>(() => Number(form.intervalValue.trim()))
const isIntervalValid = computed<boolean>(
  () =>
    Number.isSafeInteger(intervalValue.value) && intervalValue.value >= 1 && intervalValue.value <= MAX_INTERVAL_VALUE,
)
const isValid = computed<boolean>(
  () =>
    form.description.trim() !== '' && form.startDate !== '' && (amountCents.value ?? 0) > 0 && isIntervalValid.value,
)

const rules = {
  amount: (value: string): true | string => (parseAmountToCents(value) ?? 0) > 0 || t('common.invalidAmount'),
  interval: (): true | string => isIntervalValid.value || t('common.wholeNumberRange', { max: MAX_INTERVAL_VALUE }),
}

watch(open, (isOpen) => {
  if (!isOpen) return
  void Promise.all([loadObjects(), loadCosts()])
  Object.assign(form, formFor(props.rule))
  submitError.value = null
})

function inputOf(amount: number): RecurringCostInput {
  return {
    description: form.description,
    amountCents: amount,
    intervalValue: intervalValue.value,
    intervalUnit: form.intervalUnit,
    startDate: form.startDate,
    endDate: form.endDate,
    category: form.category,
    payee: form.payee,
    paymentMethod: form.paymentMethod === NO_METHOD ? null : form.paymentMethod,
    householdObjectId: form.objectId === NONE ? null : form.objectId,
    autopay: form.autopay,
    notes: form.notes,
  }
}

function submit(): Promise<void> {
  if (!isValid.value || amountCents.value === null) return Promise.resolve()
  const input = inputOf(amountCents.value)
  const { rule } = props
  return run(async () => {
    if (rule) await updateRule(rule.id, input)
    else await addRule(input)
    open.value = false
  })
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="isEditMode ? t('costs.recurring.form.editTitle') : t('costs.recurring.form.addTitle')"
    :subtitle="t('costs.recurring.form.subtitle')"
    :busy="isSaving"
    required-hint
  >
    <v-form v-bind="{ id: formId }" @submit.prevent="submit">
      <v-text-field
        v-model="form.description"
        :label="t('costs.form.description')"
        :placeholder="t('costs.recurring.form.descriptionPlaceholder')"
        autofocus
      />
      <div class="d-flex ga-4">
        <v-text-field
          v-model="form.amount"
          :label="t('costs.form.amount', { currency: currencyCode() })"
          v-bind="{ inputmode: 'decimal' }"
          :rules="[rules.amount]"
          class="flex-1-1"
        />
        <v-text-field
          v-model="form.intervalValue"
          :label="t('costs.recurring.form.every')"
          v-bind="{ inputmode: 'numeric' }"
          :rules="[rules.interval]"
          class="flex-1-1"
        />
        <v-select
          v-model="form.intervalUnit"
          :label="t('costs.recurring.form.unit')"
          :items="unitOptions"
          class="flex-1-1"
        />
      </div>
      <div class="d-flex ga-4">
        <DateField v-model="form.startDate" :label="t('costs.recurring.form.startDate')" required class="flex-1-1" />
        <DateField
          v-model="form.endDate"
          :label="t('costs.recurring.form.endDate')"
          :hint="t('costs.recurring.form.endDateHint')"
          class="flex-1-1"
        />
      </div>
      <CategoryField v-model="form.category" :suggestions="suggestions" />
      <div class="d-flex ga-4">
        <v-text-field v-model="form.payee" :label="t('costs.form.payee')" class="flex-1-1" />
        <v-select
          v-model="form.paymentMethod"
          :label="t('costs.form.paymentMethod')"
          :items="methodOptions"
          class="flex-1-1"
        />
      </div>
      <v-autocomplete v-model="form.objectId" :label="t('costs.form.object')" :items="objectOptions" />
      <v-checkbox
        :model-value="form.autopay"
        :label="t('costs.recurring.form.autopay')"
        :hint="t('costs.recurring.form.autopayHint')"
        persistent-hint
        class="mb-4"
        @update:model-value="(checked: boolean | null) => (form.autopay = checked === true)"
      />
      <v-textarea v-model="form.notes" :label="t('common.notes')" rows="2" auto-grow />
    </v-form>
    <v-alert v-if="submitError" type="error" density="compact" class="mt-4">{{ submitError }}</v-alert>

    <template #actions>
      <v-btn
        v-bind="{ type: 'submit', form: formId }"
        color="primary"
        variant="flat"
        :loading="isSaving"
        :disabled="!isValid"
      >
        {{ isEditMode ? t('common.saveChanges') : t('costs.recurring.form.save') }}
      </v-btn>
      <v-btn :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>
