<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useProjects } from '@/composables/useProjects'
import { t } from '@/i18n'
import type { Project, ProjectInput } from '@/types/project'

/**
 * Create / edit dialog for projects.
 * Without a `project` it creates a new one; with one it edits that project.
 */
const props = defineProps<{
  project?: Project | null
}>()

const emit = defineEmits<{
  /** A new project was created. */
  created: [id: number]
}>()

const open = defineModel<boolean>({ required: true })

const { addProject, updateProject } = useProjects()
const { isRunning: isSaving, error: submitError, run } = useAsyncAction()
const formId = useId()

interface FormState {
  name: string
  description: string
}

const form = reactive<FormState>({ name: '', description: '' })

const isEditMode = computed<boolean>(() => props.project != null)
const isValid = computed<boolean>(() => form.name.trim().length > 0)

const rules = {
  required: (value: string): true | string => value.trim().length > 0 || t('common.required'),
}

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, {
    name: props.project?.name ?? '',
    description: props.project?.description ?? '',
  } satisfies FormState)
  submitError.value = null
})

function submit(): Promise<void> {
  if (!isValid.value) return Promise.resolve()
  const input: ProjectInput = { name: form.name, description: form.description }
  const { project } = props
  return run(async () => {
    if (project) {
      await updateProject(project.id, input)
    } else {
      emit('created', await addProject(input))
    }
    open.value = false
  })
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="isEditMode ? t('projects.form.editTitle') : t('projects.form.addTitle')"
    :subtitle="isEditMode ? t('projects.form.editSubtitle') : t('projects.form.addSubtitle')"
    :busy="isSaving"
    required-hint
  >
    <v-form v-bind="{ id: formId }" @submit.prevent="submit">
      <v-text-field
        v-model="form.name"
        :label="t('common.nameRequired')"
        :placeholder="t('projects.form.namePlaceholder')"
        :rules="[rules.required]"
        autofocus
      />
      <v-textarea v-model="form.description" :label="t('common.descriptionOptional')" rows="2" auto-grow />
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
        {{ isEditMode ? t('common.saveChanges') : t('projects.form.save') }}
      </v-btn>
      <v-btn :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>
