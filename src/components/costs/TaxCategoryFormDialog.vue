<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useTaxCategories } from '@/composables/useTaxCategories'
import { t } from '@/i18n'
import type { TaxCategory, TaxCategoryInput } from '@/types/tax-category'

/** Creates a tax category, or edits `category`. */
const props = defineProps<{
  category?: TaxCategory | null
}>()

const open = defineModel<boolean>({ required: true })

const { addCategory, updateCategory } = useTaxCategories()
const { isRunning: isSaving, error: submitError, run } = useAsyncAction()
const formId = useId()

const form = reactive<TaxCategoryInput>({ name: '', recordsLabourCost: false })

const isEditMode = computed<boolean>(() => props.category != null)
const isValid = computed<boolean>(() => form.name.trim() !== '')

watch(open, (isOpen) => {
  if (!isOpen) return
  form.name = props.category?.name ?? ''
  form.recordsLabourCost = props.category?.recordsLabourCost ?? false
  submitError.value = null
})

function submit(): Promise<void> {
  if (!isValid.value) return Promise.resolve()
  const input: TaxCategoryInput = { name: form.name, recordsLabourCost: form.recordsLabourCost }
  const { category } = props
  return run(async () => {
    if (category) await updateCategory(category.id, input)
    else await addCategory(input)
    open.value = false
  })
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="isEditMode ? t('settings.finance.form.editTitle') : t('settings.finance.form.addTitle')"
    :subtitle="t('settings.finance.form.subtitle')"
    :busy="isSaving"
    size="small"
    required-hint
  >
    <v-form v-bind="{ id: formId }" @submit.prevent="submit">
      <v-text-field v-model="form.name" :label="t('common.nameRequired')" autofocus />
      <v-checkbox
        :model-value="form.recordsLabourCost"
        @update:model-value="(value: boolean | null) => (form.recordsLabourCost = value === true)"
        :label="t('settings.finance.form.labour')"
        hide-details
      />
      <p class="hb-caption text-medium-emphasis ml-10">{{ t('settings.finance.form.labourHint') }}</p>
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
        {{ isEditMode ? t('common.saveChanges') : t('settings.finance.form.add') }}
      </v-btn>
      <v-btn :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>
