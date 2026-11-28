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
import {
  defaultCostCategories,
  inputOfCost,
  PAYMENT_METHODS,
  paymentMethodLabel,
  type Cost,
  type CostInput,
  type PaymentMethod,
} from '@/types/cost'
import type { DuePayment } from '@/types/recurring-cost'
import { centsToAmountInput, currencyCode, parseAmountToCents } from '@/utils/currency'
import { todayIsoDate } from '@/utils/date'

/**
 * Adds a cost (`prefill` fills in the form, e.g. from an investment), or edits `cost`.
 * With `payment` it records that due payment of a recurring cost ("Paid…"; the
 * prefill is the rule's values). Emits `created` with the new id, so receipts can be
 * attached next.
 */
const props = defineProps<{
  cost?: Cost | null
  prefill?: Partial<CostInput> | null
  payment?: DuePayment | null
}>()

const emit = defineEmits<{
  created: [id: number]
}>()

const open = defineModel<boolean>({ required: true })

const { costs, addCost, updateCost } = useCosts()
const { rules: costRules, confirmPayment } = useRecurringCosts()
const { objects, ensureLoaded: loadObjects } = useHouseholdObjects()
const { isRunning: isSaving, error: submitError, run } = useAsyncAction()
const formId = useId()

/** v-select can't hold null as a value: "none" is 0 (ids start at 1) or 'none'. */
const NONE = 0
const NO_METHOD = 'none'

interface FormState {
  description: string
  paidDate: string
  amount: string
  category: string
  payee: string
  paymentMethod: PaymentMethod | typeof NO_METHOD
  objectId: number
  notes: string
}

const form = reactive<FormState>(formFor(null, null))
/** Kept from the cost or the prefill; the form doesn't edit it. */
let investmentId: number | null = null

const isEditMode = computed<boolean>(() => props.cost != null)
const title = computed<string>(() => {
  if (isEditMode.value) return t('costs.form.editTitle')
  return props.payment ? t('costs.due.formTitle') : t('costs.form.addTitle')
})
const saveLabel = computed<string>(() => {
  if (isEditMode.value) return t('common.saveChanges')
  return props.payment ? t('costs.due.record') : t('costs.form.save')
})
/** The cost of a maintenance record: its record owns the date, the amount and the payee. */
const isRecordCost = computed<boolean>(() => props.cost != null && props.cost.maintenanceRecordId !== null)

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
const isValid = computed<boolean>(
  () => (isRecordCost.value || form.description.trim() !== '') && form.paidDate !== '' && amountCents.value !== null,
)

const rules = {
  amount: (value: string): true | string => parseAmountToCents(value) !== null || t('common.invalidAmount'),
}

function amountText(cents: number | undefined): string {
  return cents === undefined ? '' : centsToAmountInput(cents)
}

/** The form for editing `cost`, or a new cost (filled in from `prefill`). */
function formFor(cost: Cost | null | undefined, prefill: Partial<CostInput> | null | undefined): FormState {
  return formOf(cost ? inputOfCost(cost) : (prefill ?? {}))
}

function formOf(source: Partial<CostInput>): FormState {
  return {
    description: source.description ?? '',
    paidDate: source.paidDate ?? todayIsoDate(),
    amount: amountText(source.amountCents),
    category: source.category ?? '',
    payee: source.payee ?? '',
    paymentMethod: source.paymentMethod ?? NO_METHOD,
    objectId: source.householdObjectId ?? NONE,
    notes: source.notes ?? '',
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return
  void loadObjects()
  Object.assign(form, formFor(props.cost, props.prefill))
  investmentId = props.cost?.investmentId ?? props.prefill?.investmentId ?? null
  submitError.value = null
})

function inputOf(amount: number): CostInput {
  return {
    description: form.description,
    paidDate: form.paidDate,
    amountCents: amount,
    category: form.category,
    payee: form.payee,
    paymentMethod: form.paymentMethod === NO_METHOD ? null : form.paymentMethod,
    householdObjectId: form.objectId === NONE ? null : form.objectId,
    investmentId,
    notes: form.notes,
  }
}

function submit(): Promise<void> {
  if (!isValid.value || amountCents.value === null) return Promise.resolve()
  const input = inputOf(amountCents.value)
  const { cost, payment } = props
  return run(async () => {
    if (cost) await updateCost(cost.id, input)
    else if (payment) await confirmPayment(payment, input)
    else emit('created', await addCost(input))
    open.value = false
  })
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="title"
    :subtitle="payment ? t('costs.due.formSubtitle') : t('costs.form.subtitle')"
    :busy="isSaving"
    required-hint
  >
    <v-form v-bind="{ id: formId }" @submit.prevent="submit">
      <v-alert v-if="isRecordCost" type="info" density="compact" class="mb-4">
        {{ t('costs.form.recordCostHint') }}
      </v-alert>
      <v-text-field
        v-model="form.description"
        :label="isRecordCost ? t('costs.form.descriptionOptional') : t('costs.form.description')"
        :placeholder="t('costs.form.descriptionPlaceholder')"
        autofocus
      />
      <div class="d-flex ga-4">
        <DateField
          v-model="form.paidDate"
          :label="t('costs.form.paidDate')"
          required
          :disabled="isRecordCost"
          class="flex-1-1"
        />
        <v-text-field
          v-model="form.amount"
          :label="t('costs.form.amount', { currency: currencyCode() })"
          v-bind="{ inputmode: 'decimal' }"
          :rules="[rules.amount]"
          :disabled="isRecordCost"
          class="flex-1-1"
        />
      </div>
      <CategoryField v-model="form.category" :suggestions="suggestions" />
      <div class="d-flex ga-4">
        <v-text-field v-model="form.payee" :label="t('costs.form.payee')" :disabled="isRecordCost" class="flex-1-1" />
        <v-select
          v-model="form.paymentMethod"
          :label="t('costs.form.paymentMethod')"
          :items="methodOptions"
          class="flex-1-1"
        />
      </div>
      <v-autocomplete
        v-if="investmentId === null && !isRecordCost"
        v-model="form.objectId"
        :label="t('costs.form.object')"
        :items="objectOptions"
      />
      <v-textarea v-model="form.notes" :label="t('common.notes')" rows="2" auto-grow />
      <p v-if="!isEditMode" class="hb-caption text-medium-emphasis">{{ t('costs.form.receiptsHint') }}</p>
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
