<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useDashboard } from '@/composables/useDashboard'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { t } from '@/i18n'
import { COST_TYPES, costTypeLabel, type CostType } from '@/types/cost'
import {
  MAX_WIDGET_TITLE_LENGTH,
  TIME_RANGES,
  chartTypeLabel,
  findWidgetType,
  timeRangeLabel,
  widgetTypeTitle,
  type DashboardWidget,
  type WidgetSettings,
} from '@/types/dashboard'
import { matchesFilter } from '@/types/dashboard-statistics'
import { uncategorizedLabel } from '@/types/household-category'

/** Title and settings of one widget. Shows only the settings its type offers. */
const props = defineProps<{
  widget: DashboardWidget | null
}>()

const open = defineModel<boolean>({ required: true })

const { configureWidget } = useDashboard()
const { isRunning: isSaving, error: submitError, run } = useAsyncAction()
const formId = useId()
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
  costType: Choice<CostType>
}

const form = reactive<FormState>({
  title: '',
  chartType: 'bar',
  timeRange: 'last-12-months',
  categoryId: ALL,
  objectId: ALL,
  costType: ALL,
})

const type = computed(() => (props.widget ? findWidgetType(props.widget.type) : undefined))

const chartOptions = computed(() =>
  (type.value?.supports.chartTypes ?? []).map((chart) => ({ title: chartTypeLabel(chart), value: chart })),
)
const costTypeOptions = computed(() => [
  { title: t('dashboard.settings.allCostTypes'), value: ALL },
  ...COST_TYPES.map((costType) => ({ title: costTypeLabel(costType), value: costType })),
])
const timeRangeOptions = computed(() => TIME_RANGES.map((range) => ({ title: timeRangeLabel(range), value: range })))
const categoriesByName = computed(() =>
  // Sorts a fresh copy; toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  [...categories.value].sort((a, b) => a.name.localeCompare(b.name)),
)
const categoryOptions = computed(() => [
  { title: t('dashboard.settings.allCategories'), value: ALL },
  ...categoriesByName.value.map((category) => ({ title: category.name, value: category.id })),
  { title: uncategorizedLabel(), value: 'none' },
])
/** The objects of the chosen category. */
const objectOptions = computed(() => [
  { title: t('dashboard.settings.allObjects'), value: ALL },
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
    costType: settings.costType ?? ALL,
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

function submit(): Promise<void> {
  const { widget } = props
  if (!widget) return Promise.resolve()
  const settings: WidgetSettings = {
    chartType: form.chartType,
    timeRange: form.timeRange,
    categoryId: toFilter(form.categoryId),
    objectId: toFilter(form.objectId),
    costType: toFilter(form.costType),
  }
  const title = form.title
  return run(async () => {
    await configureWidget(widget.id, title, settings)
    open.value = false
  })
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="t('dashboard.settings.title')"
    :subtitle="type ? widgetTypeTitle(type) : undefined"
    :busy="isSaving"
  >
    <v-form v-if="type" v-bind="{ id: formId }" @submit.prevent="submit">
      <v-text-field
        v-model="form.title"
        :label="t('dashboard.settings.widgetTitle')"
        :placeholder="widgetTypeTitle(type)"
        :counter="MAX_WIDGET_TITLE_LENGTH"
        :hint="t('dashboard.settings.titleHint')"
        persistent-hint
      />
      <v-select
        v-if="chartOptions.length > 0"
        v-model="form.chartType"
        :label="t('dashboard.settings.chartType')"
        :items="chartOptions"
        :hint="type.id === 'costs' ? t('dashboard.settings.doughnutHint') : undefined"
        :persistent-hint="type.id === 'costs'"
      />
      <v-select
        v-if="type.supports.costType"
        v-model="form.costType"
        :label="t('dashboard.settings.costType')"
        :items="costTypeOptions"
      />
      <v-select
        v-if="type.supports.timeRange"
        v-model="form.timeRange"
        :label="t('dashboard.settings.timeRange')"
        :items="timeRangeOptions"
      />
      <v-select
        v-if="type.supports.filter !== null"
        v-model="form.categoryId"
        :label="t('common.category')"
        :items="categoryOptions"
      />
      <v-select
        v-if="type.supports.filter === 'object'"
        v-model="form.objectId"
        :label="t('dashboard.settings.object')"
        :items="objectOptions"
      />
    </v-form>
    <v-alert v-if="submitError" type="error" density="compact" class="mt-4">{{ submitError }}</v-alert>

    <template #actions>
      <v-btn v-bind="{ type: 'submit', form: formId }" color="primary" variant="flat" :loading="isSaving">
        {{ t('common.save') }}
      </v-btn>
      <v-btn :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>
