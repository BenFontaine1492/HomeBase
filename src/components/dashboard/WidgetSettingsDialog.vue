<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useDashboard } from '@/composables/useDashboard'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import {
  CHART_TYPE_LABELS,
  MAX_WIDGET_TITLE_LENGTH,
  TIME_RANGES,
  TIME_RANGE_LABELS,
  findWidgetType,
  type DashboardWidget,
  type WidgetSettings,
} from '@/types/dashboard'
import { matchesFilter } from '@/types/dashboard-statistics'
import { UNCATEGORIZED_LABEL } from '@/types/household-category'
import { describeError } from '@/utils/error'

/** Title and settings of one widget. Shows only the settings its type offers. */
const props = defineProps<{
  widget: DashboardWidget | null
}>()

const open = defineModel<boolean>({ required: true })

const { configureWidget } = useDashboard()
const { categories, ensureLoaded: loadCategories } = useHouseholdCategories()
const { objects, ensureLoaded: loadObjects } = useHouseholdObjects()

/** v-select can't hold null as a value: 'all' stands for "no filter". */
const ALL = 'all'
type Choice<T> = T | typeof ALL

interface FormState {
  title: string
  chartType: WidgetSettings['chartType']
  timeRange: WidgetSettings['timeRange']
  categoryId: Choice<number | 'none'>
  objectId: Choice<number>
}

const form = reactive<FormState>({
  title: '',
  chartType: 'bar',
  timeRange: 'last-12-months',
  categoryId: ALL,
  objectId: ALL,
})
const isSaving = ref(false)
const submitError = ref<string | null>(null)

const type = computed(() => (props.widget ? findWidgetType(props.widget.type) : undefined))

const chartOptions = computed(() =>
  (type.value?.supports.chartTypes ?? []).map((chart) => ({ title: CHART_TYPE_LABELS[chart], value: chart })),
)
const timeRangeOptions = TIME_RANGES.map((range) => ({ title: TIME_RANGE_LABELS[range], value: range }))
const categoriesByName = computed(() =>
  // Sorts a fresh copy; toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  [...categories.value].sort((a, b) => a.name.localeCompare(b.name)),
)
const categoryOptions = computed(() => [
  { title: 'All categories', value: ALL },
  ...categoriesByName.value.map((category) => ({ title: category.name, value: category.id })),
  { title: UNCATEGORIZED_LABEL, value: 'none' },
])
/** The objects of the chosen category. */
const objectOptions = computed(() => [
  { title: 'All objects', value: ALL },
  ...objects.value
    .filter((object) => matchesFilter(object, { categoryId: toFilter(form.categoryId), objectId: null }))
    // A fresh array; toSorted() needs lib ES2023 (tsconfig has ES2022).
    // oxlint-disable-next-line unicorn/no-array-sort
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((object) => ({ title: object.name, value: object.id })),
])

function toFilter<T>(choice: Choice<T>): T | null {
  return choice === ALL ? null : choice
}

function resetForm(widget: DashboardWidget): void {
  const { settings } = widget
  Object.assign(form, {
    title: widget.title ?? '',
    chartType: settings.chartType,
    timeRange: settings.timeRange,
    categoryId: settings.categoryId ?? ALL,
    objectId: settings.objectId ?? ALL,
  } satisfies FormState)
  submitError.value = null
}

/** Choices that are no longer offered (a deleted category or object, or an object outside the category) become "all". */
function dropStaleChoices(): void {
  if (!categoryOptions.value.some((option) => option.value === form.categoryId)) form.categoryId = ALL
  if (!objectOptions.value.some((option) => option.value === form.objectId)) form.objectId = ALL
}

async function prepareForm(widget: DashboardWidget): Promise<void> {
  resetForm(widget)
  await Promise.all([loadCategories(), loadObjects()])
  dropStaleChoices()
}

watch(open, (isOpen) => {
  if (isOpen && props.widget) void prepareForm(props.widget)
})

watch(() => form.categoryId, dropStaleChoices)

async function submit(): Promise<void> {
  if (!props.widget || isSaving.value) return
  isSaving.value = true
  submitError.value = null
  const settings: WidgetSettings = {
    chartType: form.chartType,
    timeRange: form.timeRange,
    categoryId: toFilter(form.categoryId),
    objectId: toFilter(form.objectId),
  }
  try {
    await configureWidget(props.widget.id, form.title, settings)
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
    <v-card v-if="type" class="pa-2">
      <v-card-title class="text-title-large font-weight-bold pt-4 px-6">Widget settings</v-card-title>
      <v-card-subtitle class="px-6">{{ type.title }}</v-card-subtitle>

      <v-form class="px-6 pt-6" @submit.prevent="submit">
        <v-text-field
          v-model="form.title"
          label="Title"
          :placeholder="type.title"
          :counter="MAX_WIDGET_TITLE_LENGTH"
          hint="Leave empty for the default title."
          persistent-hint
          class="mb-4"
        />
        <v-select
          v-if="chartOptions.length > 0"
          v-model="form.chartType"
          label="Chart type"
          :items="chartOptions"
          :hint="
            type.id === 'maintenance-costs'
              ? 'A doughnut splits the costs by category, or by object when filtered.'
              : undefined
          "
          :persistent-hint="type.id === 'maintenance-costs'"
          class="mb-4"
        />
        <v-select
          v-if="type.supports.timeRange"
          v-model="form.timeRange"
          label="Time range"
          :items="timeRangeOptions"
        />
        <v-select
          v-if="type.supports.filter !== null"
          v-model="form.categoryId"
          label="Category"
          :items="categoryOptions"
        />
        <v-select
          v-if="type.supports.filter === 'object'"
          v-model="form.objectId"
          label="Object"
          :items="objectOptions"
        />

        <v-alert v-if="submitError" type="error" class="mb-4" density="compact">
          {{ submitError }}
        </v-alert>

        <v-card-actions class="px-0 pb-4">
          <v-spacer />
          <v-btn variant="text" :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">Cancel</v-btn>
          <v-btn v-bind="{ type: 'submit' }" color="primary" variant="flat" :loading="isSaving">Save</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>
