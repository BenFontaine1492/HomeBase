<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import DateField from '@/components/common/DateField.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useMaintenance } from '@/composables/useMaintenance'
import { t } from '@/i18n'
import type { MaintenanceRecord, MaintenanceRecordInput } from '@/types/maintenance-record'
import type { MaintenanceTask } from '@/types/maintenance-task'
import { centsToAmountInput, currencyCode, parseAmountToCents } from '@/utils/currency'
import { todayIsoDate } from '@/utils/date'

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
const { isRunning: isSaving, error: submitError, run } = useAsyncAction()
const formId = useId()

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

function optionalAmount(value: string): true | string {
  return value.trim() === '' || parseAmountToCents(value) !== null || t('common.invalidAmount')
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

function submit(): Promise<void> {
  if (!isValid.value) return Promise.resolve()
  const input: MaintenanceRecordInput = {
    taskId: form.taskId === NO_TASK ? null : form.taskId,
    date: form.date,
    costCents: costCents.value,
    provider: form.provider,
    notes: form.notes,
  }
  const { record, objectId } = props
  return run(async () => {
    if (record) await updateRecord(record.id, input)
    else await addRecord(objectId, input)
    open.value = false
  })
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="isEditMode ? t('maintenance.recordForm.editTitle') : t('maintenance.recordForm.addTitle')"
    :subtitle="isEditMode ? t('maintenance.recordForm.editSubtitle') : t('maintenance.recordForm.addSubtitle')"
    :busy="isSaving"
    required-hint
  >
    <v-form v-bind="{ id: formId }" @submit.prevent="submit">
      <v-select v-model="form.taskId" :label="t('maintenance.recordForm.task')" :items="taskOptions" />
      <div class="d-flex ga-4">
        <DateField v-model="form.date" :label="t('maintenance.recordForm.date')" required class="flex-1-1" />
        <v-text-field
          v-model="form.cost"
          :label="t('maintenance.recordForm.cost', { currency: currencyCode() })"
          v-bind="{ inputmode: 'decimal' }"
          :rules="[optionalAmount]"
          class="flex-1-1"
        />
      </div>
      <v-text-field
        v-model="form.provider"
        :label="t('maintenance.recordForm.provider')"
        :placeholder="t('maintenance.recordForm.providerPlaceholder')"
      />
      <v-textarea v-model="form.notes" :label="t('common.notes')" rows="2" auto-grow />
      <p v-if="!isEditMode" class="hb-caption text-medium-emphasis">{{ t('maintenance.recordForm.receiptsHint') }}</p>
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
        {{ isEditMode ? t('common.saveChanges') : t('maintenance.recordForm.save') }}
      </v-btn>
      <v-btn :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>
