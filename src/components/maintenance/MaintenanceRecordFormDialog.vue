<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMaintenance } from '@/composables/useMaintenance'
import { t } from '@/i18n'
import type { MaintenanceRecord, MaintenanceRecordInput } from '@/types/maintenance-record'
import type { MaintenanceTask } from '@/types/maintenance-task'
import { centsToAmountInput, currencyCode, parseAmountToCents } from '@/utils/currency'
import { todayIsoDate } from '@/utils/date'
import { describeError } from '@/utils/error'

/**
 * Adds a history entry to object `objectId` ("Mark as done" preselects `task`
 * and today), or edits `record`.
 */
const props = defineProps<{
  objectId: number
  record?: MaintenanceRecord | null
  task?: MaintenanceTask | null
}>()

const open = defineModel<boolean>({ required: true })

const { addRecord, updateRecord, tasksOf } = useMaintenance()

/** v-select can't hold null as a value, so "no task" is 0 (ids start at 1). */
const NO_TASK = 0

interface FormState {
  taskId: number
  date: string
  cost: string
  provider: string
  notes: string
}

const form = reactive<FormState>({ taskId: NO_TASK, date: '', cost: '', provider: '', notes: '' })
const isSaving = ref(false)
const submitError = ref<string | null>(null)

const isEditMode = computed<boolean>(() => props.record != null)
const taskOptions = computed<{ title: string; value: number }[]>(() => [
  ...tasksOf(props.objectId).map((task) => ({ title: task.name, value: task.id })),
  { title: t('maintenance.recordForm.otherWork'), value: NO_TASK },
])

/** null = empty input (allowed), undefined = invalid input. */
const costCents = computed<number | null | undefined>(() =>
  form.cost.trim() === '' ? null : (parseAmountToCents(form.cost) ?? undefined),
)
const isValid = computed<boolean>(() => form.date !== '' && costCents.value !== undefined)

const rules = {
  required: (value: string): true | string => value.trim().length > 0 || t('common.required'),
  optionalAmount: (value: string): true | string =>
    value.trim() === '' || parseAmountToCents(value) !== null || t('common.invalidAmount'),
}

/** The form for editing `record`, or a new entry (for `task`, done today). */
function formFor(record: MaintenanceRecord | null | undefined, task: MaintenanceTask | null | undefined): FormState {
  if (!record) return { taskId: task?.id ?? NO_TASK, date: todayIsoDate(), cost: '', provider: '', notes: '' }
  return {
    taskId: record.taskId ?? NO_TASK,
    date: record.date,
    cost: record.costCents === null ? '' : centsToAmountInput(record.costCents),
    provider: record.provider ?? '',
    notes: record.notes ?? '',
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, formFor(props.record, props.task))
  submitError.value = null
})

async function submit(): Promise<void> {
  if (!isValid.value || isSaving.value) return
  isSaving.value = true
  submitError.value = null
  const input: MaintenanceRecordInput = {
    taskId: form.taskId === NO_TASK ? null : form.taskId,
    date: form.date,
    costCents: costCents.value,
    provider: form.provider,
    notes: form.notes,
  }
  try {
    if (props.record) await updateRecord(props.record.id, input)
    else await addRecord(props.objectId, input)
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
        {{ isEditMode ? t('maintenance.recordForm.editTitle') : t('maintenance.recordForm.addTitle') }}
      </v-card-title>
      <v-card-subtitle class="px-6">
        {{ isEditMode ? t('maintenance.recordForm.editSubtitle') : t('maintenance.recordForm.addSubtitle') }}
      </v-card-subtitle>

      <v-form class="px-6 pt-6" @submit.prevent="submit">
        <v-select v-model="form.taskId" :label="t('maintenance.recordForm.task')" :items="taskOptions" />
        <div class="d-flex ga-4">
          <v-text-field
            v-model="form.date"
            :label="t('maintenance.recordForm.date')"
            type="date"
            :rules="[rules.required]"
            class="flex-1-1"
          />
          <v-text-field
            v-model="form.cost"
            :label="t('maintenance.recordForm.cost', { currency: currencyCode() })"
            v-bind="{ inputmode: 'decimal' }"
            :rules="[rules.optionalAmount]"
            class="flex-1-1"
          />
        </div>
        <v-text-field
          v-model="form.provider"
          :label="t('maintenance.recordForm.provider')"
          :placeholder="t('maintenance.recordForm.providerPlaceholder')"
        />
        <v-textarea v-model="form.notes" :label="t('common.notes')" rows="2" auto-grow />
        <p v-if="!isEditMode" class="record-form__hint mb-4">{{ t('maintenance.recordForm.receiptsHint') }}</p>

        <v-alert v-if="submitError" type="error" class="mb-4" density="compact">
          {{ submitError }}
        </v-alert>

        <v-card-actions class="px-0 pb-4">
          <v-spacer />
          <v-btn variant="text" :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{
            t('common.cancel')
          }}</v-btn>
          <v-btn v-bind="{ type: 'submit' }" color="primary" variant="flat" :loading="isSaving" :disabled="!isValid">
            {{ isEditMode ? t('common.saveChanges') : t('maintenance.recordForm.save') }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.record-form__hint {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
