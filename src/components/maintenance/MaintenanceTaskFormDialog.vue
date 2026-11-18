<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
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
import { describeError } from '@/utils/error'

/** Create / edit dialog for a maintenance task of object `objectId`. */
const props = defineProps<{
  objectId: number
  task?: MaintenanceTask | null
}>()

const open = defineModel<boolean>({ required: true })

const { addTask, updateTask } = useMaintenance()

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
const isSaving = ref(false)
const submitError = ref<string | null>(null)

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

async function submit(): Promise<void> {
  if (!isValid.value || form.preset === null || isSaving.value) return
  isSaving.value = true
  submitError.value = null
  const input: MaintenanceTaskInput = {
    name: form.name,
    ...intervalOf(form.preset, customDays.value),
    lastDoneDate: form.lastDoneDate,
    notes: form.notes,
    active: form.active,
  }
  try {
    if (props.task) await updateTask(props.task.id, input)
    else await addTask(props.objectId, input)
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
        {{ isEditMode ? t('maintenance.taskForm.editTitle') : t('maintenance.taskForm.addTitle') }}
      </v-card-title>
      <v-card-subtitle class="px-6">{{ t('maintenance.taskForm.subtitle') }}</v-card-subtitle>

      <v-form class="px-6 pt-6" @submit.prevent="submit">
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
        <v-text-field
          v-model="form.lastDoneDate"
          :label="t('maintenance.taskForm.lastDone')"
          type="date"
          :hint="t('maintenance.taskForm.lastDoneHint')"
          persistent-hint
          class="mb-4"
        />
        <v-textarea v-model="form.notes" :label="t('common.notes')" rows="2" auto-grow />
        <v-switch
          :model-value="form.active"
          color="primary"
          @update:model-value="(active: boolean | null) => (form.active = active === true)"
          :label="t('maintenance.taskForm.active')"
          hide-details
          class="mb-4"
        />
        <div class="required-hint mb-4">{{ t('common.requiredHint') }}</div>

        <v-alert v-if="submitError" type="error" class="mb-4" density="compact">
          {{ submitError }}
        </v-alert>

        <v-card-actions class="px-0 pb-4">
          <v-spacer />
          <v-btn variant="text" :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{
            t('common.cancel')
          }}</v-btn>
          <v-btn v-bind="{ type: 'submit' }" color="primary" variant="flat" :loading="isSaving" :disabled="!isValid">
            {{ isEditMode ? t('common.saveChanges') : t('maintenance.panel.addTask') }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.required-hint {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
