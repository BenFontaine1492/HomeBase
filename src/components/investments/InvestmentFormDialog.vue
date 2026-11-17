<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Investment, InvestmentInput, InvestmentPriority } from '@/types/investment'
import { useInvestments } from '@/composables/useInvestments'
import { describeError } from '@/utils/error'
import { CURRENCY, centsToAmountInput, parseAmountToCents } from '@/utils/currency'

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
}

const priorityOptions: { title: string; value: InvestmentPriority }[] = [
  { title: 'High', value: 'high' },
  { title: 'Medium', value: 'medium' },
  { title: 'Low', value: 'low' },
]

const form = reactive<FormState>({ title: '', description: '', amount: '', priority: 'medium' })
const isSaving = ref(false)
const submitError = ref<string | null>(null)

const isEditMode = computed<boolean>(() => props.investment != null)
const estimatedCostCents = computed<number | null>(() => parseAmountToCents(form.amount))
const isValid = computed<boolean>(
  () => form.title.trim().length > 0 && estimatedCostCents.value !== null,
)

const rules = {
  required: (value: string): true | string => value.trim().length > 0 || 'Required',
  amount: (value: string): true | string =>
    parseAmountToCents(value) !== null || 'Enter a valid amount',
}

function resetForm(investment: Investment | null | undefined): void {
  Object.assign(form, {
    title: investment?.title ?? '',
    description: investment?.description ?? '',
    amount: investment ? centsToAmountInput(investment.estimatedCostCents) : '',
    priority: investment?.priority ?? 'medium',
  } satisfies FormState)
  submitError.value = null
}

watch(open, (isOpen) => {
  if (isOpen) resetForm(props.investment)
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
  <v-dialog v-model="open" max-width="520" :persistent="isSaving">
    <v-card class="pa-2">
      <v-card-title class="text-title-large font-weight-bold pt-4 px-6">
        {{ isEditMode ? 'Edit investment' : 'Add investment' }}
      </v-card-title>
      <v-card-subtitle class="px-6">
        {{ isEditMode ? 'Update the details of this planned purchase.' : 'Plan a future purchase for your home.' }}
      </v-card-subtitle>

      <v-form class="px-6 pt-6" @submit.prevent="submit">
        <v-text-field
          v-model="form.title"
          label="Title *"
          placeholder="e.g. Heat pump replacement"
          :rules="[rules.required]"
          autofocus
        />
        <v-textarea v-model="form.description" label="Description (optional)" rows="2" auto-grow />
        <div class="d-flex ga-4">
          <v-text-field
            v-model="form.amount"
            :label="`Estimated cost (${CURRENCY}) *`"
            v-bind="{ inputmode: 'decimal' }"
            :rules="[rules.amount]"
            class="flex-1-1"
          />
          <v-select
            v-model="form.priority"
            :items="priorityOptions"
            label="Priority"
            class="flex-1-1"
          />
        </div>

        <v-alert v-if="submitError" type="error" class="mb-4" density="compact">
          {{ submitError }}
        </v-alert>

        <v-card-actions class="px-0 pb-4">
          <v-spacer />
          <v-btn variant="text" :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">Cancel</v-btn>
          <v-btn
            v-bind="{ type: 'submit' }"
            color="primary"
            variant="flat"
            :loading="isSaving"
            :disabled="!isValid"
          >
            {{ isEditMode ? 'Save changes' : 'Save investment' }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>
