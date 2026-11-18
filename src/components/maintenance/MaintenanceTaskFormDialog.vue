<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMaintenance } from '@/composables/useMaintenance'
import {
  INTERVAL_PRESET_LABELS,
  INTERVAL_PRESETS,
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
const presetOptions = INTERVAL_PRESETS.map((preset) => ({ title: INTERVAL_PRESET_LABELS[preset], value: preset }))

const customDays = computed<number>(() => Number(form.customDays.trim()))
const isCustomDaysValid = computed<boolean>(
  () => Number.isSafeInteger(customDays.value) && customDays.value >= 1 && customDays.value <= MAX_INTERVAL_VALUE,
)
const isValid = computed<boolean>(
  () => form.name.trim().length > 0 && form.preset !== null && (form.preset !== 'custom' || isCustomDaysValid.value),
)

const rules = {
  required: (value: string): true | string => value.trim().length > 0 || 'Required',
  days: (): true | string => isCustomDaysValid.value || `Enter a whole number from 1 to ${MAX_INTERVAL_VALUE}`,
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
        {{ isEditMode ? 'Edit maintenance task' : 'Add maintenance task' }}
      </v-card-title>
      <v-card-subtitle class="px-6"
        >Something that has to be done regularly, e.g. a service or a filter change.</v-card-subtitle
      >

      <v-form class="px-6 pt-6" @submit.prevent="submit">
        <v-text-field
          v-model="form.name"
          label="Task *"
          placeholder="e.g. Annual service"
          :rules="[rules.required]"
          autofocus
        />
        <div class="d-flex ga-4">
          <v-select
            v-model="form.preset"
            label="Interval *"
            :items="presetOptions"
            :hint="task && form.preset === null ? `Currently: ${intervalLabel(task)}` : undefined"
            persistent-hint
            class="flex-1-1"
          />
          <v-text-field
            v-if="form.preset === 'custom'"
            v-model="form.customDays"
            label="Every … days *"
            v-bind="{ inputmode: 'numeric' }"
            :rules="[rules.days]"
            class="flex-1-1"
          />
        </div>
        <v-text-field
          v-model="form.lastDoneDate"
          label="Last done (before you recorded it here)"
          type="date"
          hint="Optional. Entries in the history count too; the newest date is used."
          persistent-hint
          class="mb-4"
        />
        <v-textarea v-model="form.notes" label="Notes" rows="2" auto-grow />
        <v-switch
          :model-value="form.active"
          color="primary"
          @update:model-value="(active: boolean | null) => (form.active = active === true)"
          label="Active (paused tasks are not scheduled)"
          hide-details
          class="mb-4"
        />
        <div class="required-hint mb-4">* Required</div>

        <v-alert v-if="submitError" type="error" class="mb-4" density="compact">
          {{ submitError }}
        </v-alert>

        <v-card-actions class="px-0 pb-4">
          <v-spacer />
          <v-btn variant="text" :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">Cancel</v-btn>
          <v-btn v-bind="{ type: 'submit' }" color="primary" variant="flat" :loading="isSaving" :disabled="!isValid">
            {{ isEditMode ? 'Save changes' : 'Add task' }}
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
