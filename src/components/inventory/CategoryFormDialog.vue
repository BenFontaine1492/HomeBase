<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { t } from '@/i18n'
import {
  CATEGORY_ICONS,
  categoryIconLabel,
  DEFAULT_CATEGORY_ICON,
  type HouseholdCategory,
  type HouseholdCategoryInput,
} from '@/types/household-category'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'

/**
 * Create / edit dialog for inventory categories.
 * Without a `category` it creates a new one; with one it edits that category.
 */
const props = defineProps<{
  category?: HouseholdCategory | null
}>()

const open = defineModel<boolean>({ required: true })

const { addCategory, updateCategory } = useHouseholdCategories()
const { isRunning: isSaving, error: submitError, run } = useAsyncAction()
const formId = useId()

interface FormState {
  name: string
  description: string
  icon: string
}

const form = reactive<FormState>({ name: '', description: '', icon: DEFAULT_CATEGORY_ICON })

const isEditMode = computed<boolean>(() => props.category != null)
const isValid = computed<boolean>(() => form.name.trim().length > 0)

const rules = {
  required: (value: string): true | string => value.trim().length > 0 || t('common.required'),
}

function resetForm(category: HouseholdCategory | null | undefined): void {
  Object.assign(form, {
    name: category?.name ?? '',
    description: category?.description ?? '',
    icon: category?.icon ?? DEFAULT_CATEGORY_ICON,
  } satisfies FormState)
  submitError.value = null
}

watch(open, (isOpen) => {
  if (isOpen) resetForm(props.category)
})

function submit(): Promise<void> {
  if (!isValid.value) return Promise.resolve()
  const input: HouseholdCategoryInput = {
    name: form.name,
    description: form.description,
    icon: form.icon,
  }
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
    :title="isEditMode ? t('inventory.categoryForm.editTitle') : t('inventory.categoryForm.addTitle')"
    :subtitle="isEditMode ? t('inventory.categoryForm.editSubtitle') : t('inventory.categoryForm.addSubtitle')"
    :busy="isSaving"
    required-hint
  >
    <v-form v-bind="{ id: formId }" @submit.prevent="submit">
      <v-text-field
        v-model="form.name"
        :label="t('common.nameRequired')"
        :placeholder="t('inventory.categoryForm.namePlaceholder')"
        :rules="[rules.required]"
        autofocus
      />
      <v-text-field
        v-model="form.description"
        :label="t('common.descriptionOptional')"
        :placeholder="t('inventory.categoryForm.descriptionPlaceholder')"
      />

      <div class="hb-caption text-medium-emphasis mb-2">{{ t('inventory.categoryForm.icon') }}</div>
      <div class="icon-picker">
        <v-btn
          v-for="option in CATEGORY_ICONS"
          :key="option.icon"
          :icon="option.icon"
          :color="form.icon === option.icon ? 'primary' : undefined"
          :variant="form.icon === option.icon ? 'flat' : 'text'"
          v-bind="{
            onClick: () => (form.icon = option.icon),
            title: categoryIconLabel(option),
            'aria-label': categoryIconLabel(option),
            'aria-pressed': form.icon === option.icon,
          }"
        />
      </div>
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
        {{ isEditMode ? t('common.saveChanges') : t('inventory.categoryForm.save') }}
      </v-btn>
      <v-btn :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>

<style scoped>
.icon-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 8px;
  justify-items: center;
}
</style>
