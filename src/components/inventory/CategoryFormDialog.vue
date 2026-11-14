<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  type HouseholdCategory,
  type HouseholdCategoryInput,
} from '@/types/household-category'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { describeError } from '@/services/database/database-error'

/**
 * Create / edit dialog for inventory categories.
 * Without a `category` it creates a new one; with one it edits that category.
 */
const props = defineProps<{
  category?: HouseholdCategory | null
}>()

const open = defineModel<boolean>({ required: true })

const { addCategory, updateCategory } = useHouseholdCategories()

interface FormState {
  name: string
  description: string
  icon: string
}

const form = reactive<FormState>({ name: '', description: '', icon: DEFAULT_CATEGORY_ICON })
const isSaving = ref(false)
const submitError = ref<string | null>(null)

const isEditMode = computed<boolean>(() => props.category != null)
const isValid = computed<boolean>(() => form.name.trim().length > 0)

const rules = {
  required: (value: string): true | string => value.trim().length > 0 || 'Required',
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

async function submit(): Promise<void> {
  if (!isValid.value || isSaving.value) return
  isSaving.value = true
  submitError.value = null
  const input: HouseholdCategoryInput = {
    name: form.name,
    description: form.description,
    icon: form.icon,
  }
  try {
    if (props.category) await updateCategory(props.category.id, input)
    else await addCategory(input)
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
        {{ isEditMode ? 'Edit category' : 'Add category' }}
      </v-card-title>
      <v-card-subtitle class="px-6">
        {{ isEditMode ? 'Update the name, icon or description.' : 'Group your household objects, e.g. by system or room.' }}
      </v-card-subtitle>

      <v-form class="px-6 pt-6" @submit.prevent="submit">
        <v-text-field
          v-model="form.name"
          label="Name *"
          placeholder="e.g. Heating"
          :rules="[rules.required]"
          autofocus
        />
        <v-text-field
          v-model="form.description"
          label="Description (optional)"
          placeholder="e.g. Boilers, heat pumps, radiators"
        />

        <div class="icon-picker__label">Icon</div>
        <div class="icon-picker mb-6">
          <v-btn
            v-for="option in CATEGORY_ICONS"
            :key="option.icon"
            :icon="option.icon"
            :color="form.icon === option.icon ? 'primary' : undefined"
            :variant="form.icon === option.icon ? 'flat' : 'text'"
            size="small"
            v-bind="{
              onClick: () => (form.icon = option.icon),
              title: option.label,
              'aria-label': option.label,
              'aria-pressed': form.icon === option.icon,
            }"
          />
        </div>

        <div class="required-hint mb-4">* Required</div>

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
            {{ isEditMode ? 'Save changes' : 'Save category' }}
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

.icon-picker__label {
  margin-bottom: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.icon-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 6px;
  justify-items: center;
}
</style>
