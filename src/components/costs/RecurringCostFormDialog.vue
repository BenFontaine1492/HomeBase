<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import DateField from '@/components/common/DateField.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { useRecurringCosts } from '@/composables/useRecurringCosts'
import { useTaxCategories } from '@/composables/useTaxCategories'
import { t } from '@/i18n'
import {
  COST_TYPES,
  costTypeLabel,
  PAYMENT_METHODS,
  paymentMethodLabel,
  type CostType,
  type PaymentMethod,
} from '@/types/cost'
import { INTERVAL_UNITS, MAX_INTERVAL_VALUE, type IntervalUnit } from '@/types/maintenance-task'
import { inputOfRule, type RecurringCost, type RecurringCostInput } from '@/types/recurring-cost'
import { centsToAmountInput, currencyCode, parseAmountToCents } from '@/utils/currency'
import { todayIsoDate } from '@/utils/date'

/** Creates a rule for a recurring cost, or edits `rule`. */
const props = defineProps<{
  rule?: RecurringCost | null
}>()

const open = defineModel<boolean>({ required: true })

const { addRule, updateRule } = useRecurringCosts()
const { categories, findCategory, ensureLoaded: loadCategories } = useTaxCategories()
const { objects, ensureLoaded: loadObjects } = useHouseholdObjects()
const { isRunning: isSaving, error: submitError, run } = useAsyncAction()
const formId = useId()

/** v-select can't hold null as a value: "none" is 0 (ids start at 1) or 'none'. */
const NONE = 0
const NO_METHOD = 'none'

interface FormState {
  description: string
  amount: string
  labour: string
  intervalValue: string
  intervalUnit: IntervalUnit
  startDate: string
  endDate: string
  costType: CostType
  taxCategoryId: number
  payee: string
  paymentMethod: PaymentMethod | typeof NO_METHOD
  objectId: number
  autopay: boolean
  notes: string
}

function amountText(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : centsToAmountInput(cents)
}

/** A new rule: monthly, starting today. */
function newForm(): FormState {
  return {
    description: '',
    amount: '',
    labour: '',
    intervalValue: '1',
    intervalUnit: 'month',
    startDate: todayIsoDate(),
    endDate: '',
    costType: 'insurance',
    taxCategoryId: NONE,
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
    amount: amountText(source.amountCents),
    labour: amountText(source.labourCents),
    intervalValue: String(source.intervalValue),
    intervalUnit: source.intervalUnit,
    startDate: source.startDate,
    endDate: source.endDate ?? '',
    costType: source.costType,
    taxCategoryId: source.taxCategoryId ?? NONE,
    payee: source.payee ?? '',
    paymentMethod: source.paymentMethod ?? NO_METHOD,
    objectId: source.householdObjectId ?? NONE,
    autopay: source.autopay,
    notes: source.notes ?? '',
  }
}

const form = reactive<FormState>(formFor(null))

const isEditMode = computed<boolean>(() => props.rule != null)
/** Taxes and fees are a group of their own for the tax advisor: no tax category, no labour share. */
const isTax = computed<boolean>(() => form.costType === 'tax')
const showsLabour = computed<boolean>(
  () =>
    !isTax.value && findCategory(form.taxCategoryId === NONE ? null : form.taxCategoryId)?.recordsLabourCost === true,
)

const typeOptions = computed(() => COST_TYPES.map((type) => ({ title: costTypeLabel(type), value: type })))
const unitOptions = computed(() =>
  INTERVAL_UNITS.map((unit) => ({ title: t(`costs.recurring.units.${unit}`), value: unit })),
)
const categoryOptions = computed(() => [
  { title: t('costs.form.noTaxCategory'), value: NONE },
  ...categories.value.map((category) => ({ title: category.name, value: category.id })),
])
const methodOptions = computed(() => [
  { title: t('costs.form.noPaymentMethod'), value: NO_METHOD },
  ...PAYMENT_METHODS.map((method) => ({ title: paymentMethodLabel(method), value: method })),
])
const objectOptions = computed(() => [
  { title: t('costs.form.noObject'), value: NONE },
  ...objects.value.map((object) => ({ title: object.name, value: object.id })),
])

const amountCents = computed<number | null>(() => parseAmountToCents(form.amount))
const labourCents = computed<number | null | undefined>(() =>
  !showsLabour.value || form.labour.trim() === '' ? null : (parseAmountToCents(form.labour) ?? undefined),
)
const intervalValue = computed<number>(() => Number(form.intervalValue.trim()))
const isIntervalValid = computed<boolean>(
  () =>
    Number.isSafeInteger(intervalValue.value) && intervalValue.value >= 1 && intervalValue.value <= MAX_INTERVAL_VALUE,
)
const isValid = computed<boolean>(
  () =>
    form.description.trim() !== '' &&
    form.startDate !== '' &&
    (amountCents.value ?? 0) > 0 &&
    labourCents.value !== undefined &&
    isIntervalValid.value,
)

const rules = {
  amount: (value: string): true | string => (parseAmountToCents(value) ?? 0) > 0 || t('common.invalidAmount'),
  interval: (): true | string => isIntervalValid.value || t('common.wholeNumberRange', { max: MAX_INTERVAL_VALUE }),
  labour: (value: string): true | string =>
    value.trim() === '' || parseAmountToCents(value) !== null || t('common.invalidAmount'),
}

watch(open, (isOpen) => {
  if (!isOpen) return
  void Promise.all([loadCategories(), loadObjects()])
  Object.assign(form, formFor(props.rule))
  submitError.value = null
})

function inputOf(amount: number): RecurringCostInput {
  return {
    description: form.description,
    amountCents: amount,
    labourCents: labourCents.value,
    intervalValue: intervalValue.value,
    intervalUnit: form.intervalUnit,
    startDate: form.startDate,
    endDate: form.endDate,
    costType: form.costType,
    taxCategoryId: isTax.value || form.taxCategoryId === NONE ? null : form.taxCategoryId,
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
      <div class="d-flex ga-4">
        <v-select
          v-model="form.costType"
          :label="t('costs.form.costType')"
          :items="typeOptions"
          class="flex-1-1"
        />
        <v-select
          v-if="!isTax"
          v-model="form.taxCategoryId"
          :label="t('costs.form.taxCategory')"
          :items="categoryOptions"
          class="flex-1-1"
        />
      </div>
      <p v-if="isTax" class="tax-hint hb-caption text-medium-emphasis">{{ t('costs.form.taxHint') }}</p>
      <v-text-field
        v-if="showsLabour"
        v-model="form.labour"
        :label="t('costs.form.labour', { currency: currencyCode() })"
        v-bind="{ inputmode: 'decimal' }"
        :rules="[rules.labour]"
      />
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

<style scoped>
/* Below the type field (its message row is 22 px), with room for the floating label of the next row. */
.tax-hint {
  margin: -8px 0 24px;
}
</style>
