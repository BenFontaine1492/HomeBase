<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useInvestments } from '@/composables/useInvestments'
import { t } from '@/i18n'
import {
  INVESTMENT_PRIORITIES,
  priorityLabel,
  type Investment,
  type InvestmentInput,
  type InvestmentPriority,
} from '@/types/investment'
import { centsToAmountInput, currencyCode, parseAmountToCents } from '@/utils/currency'
import { describeError } from '@/utils/error'

/**
 * Create / edit dialog for investments.
 * Without an `investment` it creates a new one; with one it edits that investment.
 */
const props = defineProps<{
  investment?: Investment | null
}>()

const open = defineModel<boolean>({ required: true })

const { addInvestment, updateInvestment } = useInvestments()

interface FormState {
  title: string
  description: string
  amount: string
  priority: InvestmentPriority
  targetDate: string
  budget: string
  saved: string
  purchasedDate: string
}

const form = reactive<FormState>(formFor(null))
const isSaving = ref(false)
const submitError = ref<string | null>(null)

const priorityOptions = computed(() =>
  INVESTMENT_PRIORITIES.map((priority) => ({ title: priorityLabel(priority), value: priority })),
)

const isEditMode = computed<boolean>(() => props.investment != null)
const isPurchased = computed<boolean>(() => props.investment?.status === 'purchased')

/** null = empty input (allowed), undefined = invalid input. */
function optionalCents(text: string): number | null | undefined {
  return text.trim() === '' ? null : (parseAmountToCents(text) ?? undefined)
}

const estimatedCostCents = computed<number | null>(() => parseAmountToCents(form.amount))
const budgetCents = computed(() => optionalCents(form.budget))
const savedCents = computed(() => optionalCents(form.saved))
const isValid = computed<boolean>(
  () =>
    form.title.trim().length > 0 &&
    estimatedCostCents.value !== null &&
    budgetCents.value !== undefined &&
    savedCents.value !== undefined &&
    (!isPurchased.value || form.purchasedDate !== ''),
)

const rules = {
  required: (value: string): true | string => value.trim().length > 0 || t('common.required'),
  amount: (value: string): true | string => parseAmountToCents(value) !== null || t('common.invalidAmount'),
  optionalAmount: (value: string): true | string => optionalCents(value) !== undefined || t('common.invalidAmount'),
}

function optionalAmountInput(cents: number | null): string {
  return cents === null ? '' : centsToAmountInput(cents)
}

function formFor(investment: Investment | null | undefined): FormState {
  if (!investment) {
    return {
      title: '',
      description: '',
      amount: '',
      priority: 'medium',
      targetDate: '',
      budget: '',
      saved: '',
      purchasedDate: '',
    }
  }
  return {
    title: investment.title,
    description: investment.description ?? '',
    amount: centsToAmountInput(investment.estimatedCostCents),
    priority: investment.priority,
    targetDate: investment.targetDate ?? '',
    budget: optionalAmountInput(investment.budgetCents),
    saved: optionalAmountInput(investment.savedCents),
    purchasedDate: investment.purchasedDate ?? '',
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, formFor(props.investment))
  submitError.value = null
})

async function submit(): Promise<void> {
  if (!isValid.value || estimatedCostCents.value === null || isSaving.value) return
  isSaving.value = true
  submitError.value = null
  const input: InvestmentInput = {
    title: form.title,
    description: form.description,
    estimatedCostCents: estimatedCostCents.value,
    priority: form.priority,
    status: props.investment?.status ?? 'planned',
    purchasedDate: form.purchasedDate,
    targetDate: form.targetDate,
    budgetCents: budgetCents.value ?? null,
    savedCents: savedCents.value ?? null,
  }
  try {
    if (props.investment) await updateInvestment(props.investment.id, input)
    else await addInvestment(input)
    open.value = false
  } catch (error) {
    console.error(error)
    submitError.value = describeError(error)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560" :persistent="isSaving" scrollable>
    <v-card class="pa-2">
      <v-card-title class="text-title-large font-weight-bold pt-4 px-6">
        {{ isEditMode ? t('investments.form.editTitle') : t('investments.form.addTitle') }}
      </v-card-title>
      <v-card-subtitle class="px-6">
        {{ isEditMode ? t('investments.form.editSubtitle') : t('investments.form.addSubtitle') }}
      </v-card-subtitle>

      <v-form class="px-6 pt-6" @submit.prevent="submit">
        <v-text-field
          v-model="form.title"
          :label="t('investments.form.title')"
          :placeholder="t('investments.form.titlePlaceholder')"
          :rules="[rules.required]"
          autofocus
        />
        <v-textarea v-model="form.description" :label="t('common.descriptionOptional')" rows="2" auto-grow />
        <div class="d-flex ga-4">
          <v-text-field
            v-model="form.amount"
            :label="t('investments.form.estimatedCost', { currency: currencyCode() })"
            v-bind="{ inputmode: 'decimal' }"
            :rules="[rules.amount]"
            class="flex-1-1"
          />
          <v-select
            v-model="form.priority"
            :items="priorityOptions"
            :label="t('investments.form.priority')"
            class="flex-1-1"
          />
        </div>
        <v-text-field
          v-if="isPurchased"
          v-model="form.purchasedDate"
          :label="t('investments.purchase.date')"
          type="date"
          :rules="[rules.required]"
        />

        <div class="form-section">{{ t('investments.form.planning') }}</div>
        <div class="d-flex ga-4">
          <v-text-field
            v-model="form.targetDate"
            :label="t('investments.form.targetDate')"
            type="date"
            class="flex-1-1"
          />
          <v-text-field
            v-model="form.budget"
            :label="t('investments.form.budget', { currency: currencyCode() })"
            :hint="t('investments.form.budgetHint')"
            persistent-hint
            v-bind="{ inputmode: 'decimal' }"
            :rules="[rules.optionalAmount]"
            class="flex-1-1 mb-2"
          />
        </div>
        <v-text-field
          v-model="form.saved"
          :label="t('investments.form.saved', { currency: currencyCode() })"
          :hint="t('investments.form.savedHint')"
          persistent-hint
          v-bind="{ inputmode: 'decimal' }"
          :rules="[rules.optionalAmount]"
          class="mb-4"
        />

        <v-alert v-if="submitError" type="error" class="mb-4" density="compact">
          {{ submitError }}
        </v-alert>

        <v-card-actions class="px-0 pb-4">
          <v-spacer />
          <v-btn variant="text" :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn v-bind="{ type: 'submit' }" color="primary" variant="flat" :loading="isSaving" :disabled="!isValid">
            {{ isEditMode ? t('common.saveChanges') : t('investments.form.save') }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.form-section {
  margin: 4px 0 12px;
  font-size: 0.875rem;
  font-weight: 600;
}
</style>
