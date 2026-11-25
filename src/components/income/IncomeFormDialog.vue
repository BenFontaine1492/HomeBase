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
import { defaultIncomeCategories, inputOfIncome, type Income, type IncomeInput } from '@/types/income'
import type { DueIncome } from '@/types/recurring-income'
import { centsToAmountInput, currencyCode, parseAmountToCents } from '@/utils/currency'
import { todayIsoDate } from '@/utils/date'

/**
 * Adds an income entry, or edits `income`. With `payment` it records that due payment
 * of a recurring income ("Received…"; `prefill` is the rule's values). Emits `created`
 * with the new id, so documents can be attached next.
 */
const props = defineProps<{
  income?: Income | null
  prefill?: Partial<IncomeInput> | null
  payment?: DueIncome | null
}>()

const emit = defineEmits<{
  created: [id: number]
}>()

const open = defineModel<boolean>({ required: true })

const { income: allIncome, addIncome, updateIncome } = useIncome()
const { rules: incomeRules, confirmReceipt } = useRecurringIncome()
const { objects, ensureLoaded: loadObjects } = useHouseholdObjects()
const { isRunning: isSaving, error: submitError, run } = useAsyncAction()
const formId = useId()

/** v-select can't hold null as a value: "none" is 0 (ids start at 1) or 'none'. */
const NONE = 0
const NO_METHOD = 'none'

interface FormState {
  description: string
  receivedDate: string
  amount: string
  category: string
  payer: string
  paymentMethod: PaymentMethod | typeof NO_METHOD
  objectId: number
  notes: string
}

const form = reactive<FormState>(formFor(null, null))

const isEditMode = computed<boolean>(() => props.income != null)
const title = computed<string>(() => {
  if (isEditMode.value) return t('income.form.editTitle')
  return props.payment ? t('income.due.formTitle') : t('income.form.addTitle')
})
const saveLabel = computed<string>(() => {
  if (isEditMode.value) return t('common.saveChanges')
  return props.payment ? t('income.due.record') : t('income.form.save')
})

/** The default categories, then those used before (like attribute names). */
const categorySuggestions = computed<string[]>(() =>
  suggestionsFor(
    defaultIncomeCategories(),
    [...allIncome.value, ...incomeRules.value].map((entry) => entry.category),
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
const isValid = computed<boolean>(
  () => form.description.trim() !== '' && form.receivedDate !== '' && amountCents.value !== null,
)

const rules = {
  amount: (value: string): true | string => parseAmountToCents(value) !== null || t('common.invalidAmount'),
}

function amountText(cents: number | undefined): string {
  return cents === undefined ? '' : centsToAmountInput(cents)
}

/** The form for editing `income`, or a new entry (filled in from `prefill`). */
function formFor(income: Income | null | undefined, prefill: Partial<IncomeInput> | null | undefined): FormState {
  return formOf(income ? inputOfIncome(income) : (prefill ?? {}))
}

function formOf(source: Partial<IncomeInput>): FormState {
  return {
    description: source.description ?? '',
    receivedDate: source.receivedDate ?? todayIsoDate(),
    amount: amountText(source.amountCents),
    category: source.category ?? '',
    payer: source.payer ?? '',
    paymentMethod: source.paymentMethod ?? NO_METHOD,
    objectId: source.householdObjectId ?? NONE,
    notes: source.notes ?? '',
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return
  void loadObjects()
  Object.assign(form, formFor(props.income, props.prefill))
  submitError.value = null
})

function inputOf(amount: number): IncomeInput {
  return {
    description: form.description,
    receivedDate: form.receivedDate,
    amountCents: amount,
    category: form.category,
    payer: form.payer,
    paymentMethod: form.paymentMethod === NO_METHOD ? null : form.paymentMethod,
    householdObjectId: form.objectId === NONE ? null : form.objectId,
    notes: form.notes,
  }
}

function submit(): Promise<void> {
  if (!isValid.value || amountCents.value === null) return Promise.resolve()
  const input = inputOf(amountCents.value)
  const { income, payment } = props
  return run(async () => {
    if (income) await updateIncome(income.id, input)
    else if (payment) await confirmReceipt(payment, input)
    else emit('created', await addIncome(input))
    open.value = false
  })
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="title"
    :subtitle="payment ? t('income.due.formSubtitle') : t('income.form.subtitle')"
    :busy="isSaving"
    required-hint
  >
    <v-form v-bind="{ id: formId }" @submit.prevent="submit">
      <v-text-field
        v-model="form.description"
        :label="t('income.form.description')"
        :placeholder="t('income.form.descriptionPlaceholder')"
        autofocus
      />
      <div class="d-flex ga-4">
        <DateField v-model="form.receivedDate" :label="t('income.form.receivedDate')" required class="flex-1-1" />
        <v-text-field
          v-model="form.amount"
          :label="t('costs.form.amount', { currency: currencyCode() })"
          v-bind="{ inputmode: 'decimal' }"
          :rules="[rules.amount]"
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
      <v-textarea v-model="form.notes" :label="t('common.notes')" rows="2" auto-grow />
      <p v-if="!isEditMode" class="hb-caption text-medium-emphasis">{{ t('income.form.documentsHint') }}</p>
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
        {{ saveLabel }}
      </v-btn>
      <v-btn :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>
