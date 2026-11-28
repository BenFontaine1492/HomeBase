<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import DateField from '@/components/common/DateField.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useInvestments } from '@/composables/useInvestments'
import { useProjects } from '@/composables/useProjects'
import { t } from '@/i18n'
import {
  INVESTMENT_PRIORITIES,
  priorityLabel,
  type Investment,
  type InvestmentInput,
  type InvestmentPriority,
} from '@/types/investment'
import { centsToAmountInput, currencyCode, parseAmountToCents } from '@/utils/currency'

/**
 * Create / edit dialog for investments.
 * Without an `investment` it creates a new one (in `projectId`); with one it edits that
 * investment, which can also move it to another project.
 */
const props = defineProps<{
  investment?: Investment | null
  /** The project a new investment goes into. */
  projectId?: number | null
}>()

const open = defineModel<boolean>({ required: true })

const { addInvestment, updateInvestment } = useInvestments()
const { projects } = useProjects()
const { isRunning: isSaving, error: submitError, run } = useAsyncAction()
const formId = useId()

interface FormState {
  projectId: number | null
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

const projectOptions = computed(() => projects.value.map((project) => ({ title: project.name, value: project.id })))

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
    form.projectId !== null &&
    form.title.trim().length > 0 &&
    estimatedCostCents.value !== null &&
    budgetCents.value !== undefined &&
    savedCents.value !== undefined &&
    (!isPurchased.value || form.purchasedDate !== ''),
)

const rules = {
  required: (value: string): true | string => value.trim().length > 0 || t('common.required'),
  project: (value: number | null): true | string => value !== null || t('common.required'),
  amount: (value: string): true | string => parseAmountToCents(value) !== null || t('common.invalidAmount'),
  optionalAmount: (value: string): true | string => optionalCents(value) !== undefined || t('common.invalidAmount'),
}

function optionalAmountInput(cents: number | null): string {
  return cents === null ? '' : centsToAmountInput(cents)
}

function formFor(investment: Investment | null | undefined): FormState {
  if (!investment) {
    return {
      projectId: props.projectId ?? null,
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
    projectId: investment.projectId,
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

function submit(): Promise<void> {
  if (!isValid.value || form.projectId === null || estimatedCostCents.value === null) return Promise.resolve()
  const input: InvestmentInput = {
    projectId: form.projectId,
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
  const { investment } = props
  return run(async () => {
    if (investment) await updateInvestment(investment.id, input)
    else await addInvestment(input)
    open.value = false
  })
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="isEditMode ? t('investments.form.editTitle') : t('investments.form.addTitle')"
    :subtitle="isEditMode ? t('investments.form.editSubtitle') : t('investments.form.addSubtitle')"
    :busy="isSaving"
    required-hint
  >
    <v-form v-bind="{ id: formId }" @submit.prevent="submit">
      <v-text-field
        v-model="form.title"
        :label="t('investments.form.title')"
        :placeholder="t('investments.form.titlePlaceholder')"
        :rules="[rules.required]"
        autofocus
      />
      <v-textarea v-model="form.description" :label="t('common.descriptionOptional')" rows="2" auto-grow />
      <v-select
        v-model="form.projectId"
        :items="projectOptions"
        :label="t('investments.form.project')"
        :rules="[rules.project]"
      />
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
      <DateField v-if="isPurchased" v-model="form.purchasedDate" :label="t('investments.purchase.date')" required />

      <h3 class="hb-body-strong mb-3">{{ t('investments.form.planning') }}</h3>
      <div class="d-flex ga-4">
        <DateField v-model="form.targetDate" :label="t('investments.form.targetDate')" class="flex-1-1" />
        <v-text-field
          v-model="form.budget"
          :label="t('investments.form.budget', { currency: currencyCode() })"
          :hint="t('investments.form.budgetHint')"
          persistent-hint
          v-bind="{ inputmode: 'decimal' }"
          :rules="[rules.optionalAmount]"
          class="flex-1-1"
        />
      </div>
      <v-text-field
        v-model="form.saved"
        :label="t('investments.form.saved', { currency: currencyCode() })"
        :hint="t('investments.form.savedHint')"
        persistent-hint
        v-bind="{ inputmode: 'decimal' }"
        :rules="[rules.optionalAmount]"
      />
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
        {{ isEditMode ? t('common.saveChanges') : t('investments.form.save') }}
      </v-btn>
      <v-btn :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>
