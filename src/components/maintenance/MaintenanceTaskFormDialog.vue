<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import DateField from '@/components/common/DateField.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useMaintenance } from '@/composables/useMaintenance'
import { t } from '@/i18n'
import {
  INTERVAL_PRESETS,
  intervalPresetLabel,
  intervalLabel,
  intervalOf,
  MAX_INTERVAL_VALUE,
  presetOf,
  type IntervalPreset,
  type MaintenanceTask,
  type MaintenanceTaskInput,
} from '@/types/maintenance-task'

/** Create / edit dialog for a maintenance task of object `objectId`. */
const props = defineProps<{
  objectId: number
  task?: MaintenanceTask | null
}>()

const open = defineModel<boolean>({ required: true })

const { addTask, updateTask } = useMaintenance()
const { isRunning: isSaving, error: submitError, run } = useAsyncAction()
const formId = useId()

interface FormState {
  name: string
  /** null = the stored interval can't be shown as a choice (e.g. every 3 months): pick one. */
  preset: IntervalPreset | null
  customDays: string
  lastDoneDate: string
  notes: string
  active: boolean
}

const form = reactive<FormState>({
  name: '',
  preset: 'yearly',
  customDays: '',
  lastDoneDate: '',
  notes: '',
  active: true,
})

const isEditMode = computed<boolean>(() => props.task != null)
const presetOptions = computed(() =>
  INTERVAL_PRESETS.map((preset) => ({ title: intervalPresetLabel(preset), value: preset })),
)

const customDays = computed<number>(() => Number(form.customDays.trim()))
const isCustomDaysValid = computed<boolean>(
  () => Number.isSafeInteger(customDays.value) && customDays.value >= 1 && customDays.value <= MAX_INTERVAL_VALUE,
)
const isValid = computed<boolean>(
  () => form.name.trim().length > 0 && form.preset !== null && (form.preset !== 'custom' || isCustomDaysValid.value),
)

const rules = {
  required: (value: string): true | string => value.trim().length > 0 || t('common.required'),
  days: (): true | string => isCustomDaysValid.value || t('common.wholeNumberRange', { max: MAX_INTERVAL_VALUE }),
}

/** The form for a new task, or filled from `task`. */
function formFor(task: MaintenanceTask | null | undefined): FormState {
  if (!task) return { name: '', preset: 'yearly', customDays: '', lastDoneDate: '', notes: '', active: true }
  return {
    name: task.name,
    preset: presetOf(task),
    customDays: task.intervalUnit === 'day' ? String(task.intervalValue) : '',
    lastDoneDate: task.lastDoneDate ?? '',
    notes: task.notes ?? '',
    active: task.active,
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, formFor(props.task))
  submitError.value = null
})

function submit(): Promise<void> {
  if (!isValid.value || form.preset === null) return Promise.resolve()
  const input: MaintenanceTaskInput = {
    name: form.name,
    ...intervalOf(form.preset, customDays.value),
    lastDoneDate: form.lastDoneDate,
    notes: form.notes,
    active: form.active,
  }
  const { task, objectId } = props
  return run(async () => {
    if (task) await updateTask(task.id, input)
    else await addTask(objectId, input)
    open.value = false
  })
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="isEditMode ? t('maintenance.taskForm.editTitle') : t('maintenance.taskForm.addTitle')"
    :subtitle="t('maintenance.taskForm.subtitle')"
    :busy="isSaving"
    required-hint
  >
    <v-form v-bind="{ id: formId }" @submit.prevent="submit">
      <v-text-field
        v-model="form.name"
        :label="t('maintenance.taskForm.name')"
        :placeholder="t('maintenance.taskForm.namePlaceholder')"
        :rules="[rules.required]"
        autofocus
      />
      <div class="d-flex ga-4">
        <v-select
          v-model="form.preset"
          :label="t('maintenance.taskForm.interval')"
          :items="presetOptions"
          :hint="
            task && form.preset === null
              ? t('maintenance.taskForm.currently', { interval: intervalLabel(task) })
              : undefined
          "
          persistent-hint
          class="flex-1-1"
        />
        <v-text-field
          v-if="form.preset === 'custom'"
          v-model="form.customDays"
          :label="t('maintenance.taskForm.everyDays')"
          v-bind="{ inputmode: 'numeric' }"
          :rules="[rules.days]"
          class="flex-1-1"
        />
      </div>
      <DateField
        v-model="form.lastDoneDate"
        :label="t('maintenance.taskForm.lastDone')"
        :hint="t('maintenance.taskForm.lastDoneHint')"
      />
      <v-textarea v-model="form.notes" :label="t('common.notes')" rows="2" auto-grow />
      <!-- A checkbox, not a switch: the change is only saved with the form. -->
      <v-checkbox
        :model-value="form.active"
        @update:model-value="(active: boolean | null) => (form.active = active === true)"
        :label="t('maintenance.taskForm.active')"
        hide-details
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
        {{ isEditMode ? t('common.saveChanges') : t('maintenance.panel.addTask') }}
      </v-btn>
      <v-btn :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>
