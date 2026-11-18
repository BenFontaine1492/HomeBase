<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import HouseholdObjectAttributesEditor from './HouseholdObjectAttributesEditor.vue'
import type { HouseholdObject, HouseholdObjectInput } from '@/types/household-object'
import type { HouseholdObjectAttributeDraft, HouseholdObjectAttributeInput } from '@/types/household-object-attribute'
import { UNCATEGORIZED_LABEL } from '@/types/household-category'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { describeError } from '@/utils/error'
import { CURRENCY, centsToAmountInput, parseAmountToCents } from '@/utils/currency'

/**
 * Create / edit dialog for household objects.
 * Without an `object` it creates a new one; with one it edits that object.
 */
const props = defineProps<{
  object?: HouseholdObject | null
  /** Category preselected when creating (e.g. on a category page). */
  defaultCategoryId?: number | null
  /**
   * When creating, use `defaultCategoryId` without asking (category page).
   * Editing always shows the field so an object can be moved.
   */
  lockCategory?: boolean
}>()

const open = defineModel<boolean>({ required: true })

const { categories, findCategory } = useHouseholdCategories()
const { addObject, updateObject, attributesOf, findNameMatches } = useHouseholdObjects()

/** v-select treats null as "nothing selected", so "no category" uses a sentinel. */
const NO_CATEGORY = 'none'
type CategoryChoice = number | typeof NO_CATEGORY

interface FormState {
  name: string
  categoryId: CategoryChoice
  manufacturer: string
  model: string
  serialNumber: string
  purchaseDate: string
  price: string
  installationDate: string
  location: string
  notes: string
  attributes: HouseholdObjectAttributeDraft[]
}

const form = reactive<FormState>(emptyForm())
const isSaving = ref(false)
const submitError = ref<string | null>(null)
/** Result of the field rules (incl. the attribute rows); false = at least one field is invalid. */
const areFieldsValid = ref<boolean | null>(null)

const isEditMode = computed<boolean>(() => props.object != null)
const showCategoryField = computed<boolean>(() => isEditMode.value || !props.lockCategory)

const categoryOptions = computed<{ title: string; value: CategoryChoice }[]>(() => [
  { title: UNCATEGORIZED_LABEL, value: NO_CATEGORY },
  ...categories.value.map((category) => ({ title: category.name, value: category.id })),
])

/** null = empty input (allowed), undefined = invalid input. */
const purchasePriceCents = computed<number | null | undefined>(() =>
  form.price.trim() === '' ? null : (parseAmountToCents(form.price) ?? undefined),
)

const isValid = computed<boolean>(
  () => form.name.trim().length > 0 && purchasePriceCents.value !== undefined && areFieldsValid.value !== false,
)

/**
 * Objects with the same or a similar name (any category). Only a warning:
 * saving stays possible, because two identical objects are legitimate.
 */
const nameWarnings = computed<string[]>(() =>
  findNameMatches(form.name, props.object).map(({ object, match }) => {
    const where = categoryText(object.categoryId)
    return match === 'exact'
      ? `An object named "${object.name}" already exists ${where}.`
      : `A similar object "${object.name}" exists ${where}.`
  }),
)

function categoryText(categoryId: number | null): string {
  const category = findCategory(categoryId)
  return category ? `in ${category.name}` : 'without a category'
}

const rules = {
  required: (value: string): true | string => value.trim().length > 0 || 'Required',
  optionalAmount: (value: string): true | string =>
    value.trim() === '' || parseAmountToCents(value) !== null || 'Enter a valid amount',
}

function emptyForm(): FormState {
  return {
    name: '',
    categoryId: NO_CATEGORY,
    manufacturer: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    price: '',
    installationDate: '',
    location: '',
    notes: '',
    attributes: [],
  }
}

function attributeDrafts(objectId: number): HouseholdObjectAttributeDraft[] {
  return attributesOf(objectId).map((attribute, key) => ({
    key,
    name: attribute.name,
    valueType: attribute.valueType,
    value: attribute.value ?? (attribute.valueType === 'boolean' ? '0' : ''),
    unit: attribute.unit ?? '',
  }))
}

function toChoice(categoryId: number | null | undefined): CategoryChoice {
  return categoryId ?? NO_CATEGORY
}

function resetForm(object: HouseholdObject | null | undefined): void {
  Object.assign(
    form,
    object
      ? ({
          name: object.name,
          categoryId: toChoice(object.categoryId),
          manufacturer: object.manufacturer ?? '',
          model: object.model ?? '',
          serialNumber: object.serialNumber ?? '',
          purchaseDate: object.purchaseDate ?? '',
          price: object.purchasePriceCents === null ? '' : centsToAmountInput(object.purchasePriceCents),
          installationDate: object.installationDate ?? '',
          location: object.location ?? '',
          notes: object.notes ?? '',
          attributes: attributeDrafts(object.id),
        } satisfies FormState)
      : { ...emptyForm(), categoryId: toChoice(props.defaultCategoryId) },
  )
  submitError.value = null
}

watch(open, (isOpen) => {
  if (isOpen) resetForm(props.object)
})

async function submit(): Promise<void> {
  if (!isValid.value || purchasePriceCents.value === undefined || isSaving.value) return
  isSaving.value = true
  submitError.value = null
  const input: HouseholdObjectInput = {
    name: form.name,
    categoryId: form.categoryId === NO_CATEGORY ? null : form.categoryId,
    manufacturer: form.manufacturer,
    model: form.model,
    serialNumber: form.serialNumber,
    purchaseDate: form.purchaseDate,
    purchasePriceCents: purchasePriceCents.value,
    installationDate: form.installationDate,
    location: form.location,
    notes: form.notes,
  }
  const attributes = form.attributes.map(({ name, valueType, value, unit }): HouseholdObjectAttributeInput => ({
    name,
    valueType,
    value,
    unit,
  }))
  try {
    if (props.object) await updateObject(props.object.id, input, attributes)
    else await addObject(input, attributes)
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
  <v-dialog v-model="open" max-width="720" :persistent="isSaving" scrollable>
    <v-card class="pa-2">
      <v-card-title class="text-title-large font-weight-bold pt-4 px-6">
        {{ isEditMode ? 'Edit object' : 'Add object' }}
      </v-card-title>
      <v-card-subtitle class="px-6">
        {{
          isEditMode
            ? 'Update the details and attributes of this object.'
            : 'Add an appliance, device or other item to your inventory.'
        }}
      </v-card-subtitle>

      <v-form v-model="areFieldsValid" class="object-form px-6 pt-6" @submit.prevent="submit">
        <div class="d-flex ga-4">
          <v-text-field
            v-model="form.name"
            label="Name *"
            placeholder="e.g. Heat pump"
            :rules="[rules.required]"
            autofocus
            class="flex-1-1"
          />
          <v-select
            v-if="showCategoryField"
            v-model="form.categoryId"
            :items="categoryOptions"
            label="Category"
            class="flex-1-1"
          />
        </div>
        <v-alert v-if="nameWarnings.length > 0" type="warning" variant="tonal" density="compact" class="mb-4">
          <div v-for="warning in nameWarnings" :key="warning">{{ warning }}</div>
          <div class="name-warning-hint">You can still save it if it is a different object.</div>
        </v-alert>
        <div class="d-flex ga-4">
          <v-text-field v-model="form.manufacturer" label="Manufacturer" class="flex-1-1" />
          <v-text-field v-model="form.model" label="Model" class="flex-1-1" />
        </div>
        <div class="d-flex ga-4">
          <v-text-field v-model="form.serialNumber" label="Serial number" class="flex-1-1" />
          <v-text-field v-model="form.location" label="Location / room" placeholder="e.g. Basement" class="flex-1-1" />
        </div>
        <div class="d-flex ga-4">
          <v-text-field v-model="form.purchaseDate" label="Purchase date" type="date" class="flex-1-1" />
          <v-text-field v-model="form.installationDate" label="Installation date" type="date" class="flex-1-1" />
        </div>
        <v-text-field
          v-model="form.price"
          :label="`Purchase price (${CURRENCY})`"
          v-bind="{ inputmode: 'decimal' }"
          :rules="[rules.optionalAmount]"
        />
        <v-textarea v-model="form.notes" label="Notes" rows="2" auto-grow />
        <HouseholdObjectAttributesEditor v-model="form.attributes" />
        <div class="required-hint mb-4">* Required</div>

        <v-alert v-if="submitError" type="error" class="mb-4" density="compact">
          {{ submitError }}
        </v-alert>

        <v-card-actions class="px-0 pb-4">
          <v-spacer />
          <v-btn variant="text" :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">Cancel</v-btn>
          <v-btn v-bind="{ type: 'submit' }" color="primary" variant="flat" :loading="isSaving" :disabled="!isValid">
            {{ isEditMode ? 'Save changes' : 'Save object' }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.object-form {
  overflow-y: auto;
}

.name-warning-hint {
  font-size: 0.75rem;
  opacity: var(--v-medium-emphasis-opacity);
}

.required-hint {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
