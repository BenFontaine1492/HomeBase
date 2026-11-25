<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import DateField from '@/components/common/DateField.vue'
import CategoryField from '@/components/finances/CategoryField.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { useIncome } from '@/composables/useIncome'
import { useRecurringIncome } from '@/composables/useRecurringIncome'
import { t } from '@/i18n'
import { categorySuggestions as suggestionsFor } from '@/types/category'
import { PAYMENT_METHODS, paymentMethodLabel, type PaymentMethod } from '@/types/cost'
import { defaultIncomeCategories } from '@/types/income'
import { INTERVAL_UNITS, MAX_INTERVAL_VALUE, type IntervalUnit } from '@/types/maintenance-task'
import { inputOfIncomeRule, type RecurringIncome, type RecurringIncomeInput } from '@/types/recurring-income'
import { centsToAmountInput, currencyCode, parseAmountToCents } from '@/utils/currency'
import { todayIsoDate } from '@/utils/date'

/** Creates a rule for a recurring income, or edits `rule`. */
const props = defineProps<{
  rule?: RecurringIncome | null
}>()

const open = defineModel<boolean>({ required: true })

const { income, ensureLoaded: loadIncome } = useIncome()
const { rules: incomeRules, addRule, updateRule } = useRecurringIncome()
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
  payer: string
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
    payer: '',
    paymentMethod: NO_METHOD,
    objectId: NONE,
    autopay: false,
    notes: '',
  }
}

/** The form for editing `rule`, or a new rule. */
function formFor(rule: RecurringIncome | null | undefined): FormState {
  if (!rule) return newForm()
  const source = inputOfIncomeRule(rule)
  return {
    description: source.description,
    amount: centsToAmountInput(source.amountCents),
    intervalValue: String(source.intervalValue),
    intervalUnit: source.intervalUnit,
    startDate: source.startDate,
    endDate: source.endDate ?? '',
    category: source.category ?? '',
    payer: source.payer ?? '',
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
const categorySuggestions = computed<string[]>(() =>
  suggestionsFor(
    defaultIncomeCategories(),
    [...income.value, ...incomeRules.value].map((entry) => entry.category),
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
  void Promise.all([loadObjects(), loadIncome()])
  Object.assign(form, formFor(props.rule))
  submitError.value = null
})

function inputOf(amount: number): RecurringIncomeInput {
  return {
    description: form.description,
    amountCents: amount,
    intervalValue: intervalValue.value,
    intervalUnit: form.intervalUnit,
    startDate: form.startDate,
    endDate: form.endDate,
    category: form.category,
    payer: form.payer,
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
    :title="isEditMode ? t('income.recurring.form.editTitle') : t('income.recurring.form.addTitle')"
    :subtitle="t('income.recurring.form.subtitle')"
    :busy="isSaving"
    required-hint
  >
    <v-form v-bind="{ id: formId }" @submit.prevent="submit">
      <v-text-field
        v-model="form.description"
        :label="t('income.form.description')"
        :placeholder="t('income.recurring.form.descriptionPlaceholder')"
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
      <CategoryField v-model="form.category" :suggestions="categorySuggestions" />
      <div class="d-flex ga-4">
        <v-text-field v-model="form.payer" :label="t('income.form.payer')" class="flex-1-1" />
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
        :label="t('income.recurring.form.autopay')"
        :hint="t('income.recurring.form.autopayHint')"
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
        {{ isEditMode ? t('common.saveChanges') : t('income.recurring.form.save') }}
      </v-btn>
      <v-btn :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>
