<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useCosts } from '@/composables/useCosts'
import { useDashboard } from '@/composables/useDashboard'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { useIncome } from '@/composables/useIncome'
import { t } from '@/i18n'
import { categoriesOf, categoryKey } from '@/types/category'
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
const { costs, ensureLoaded: loadCosts } = useCosts()
const { income, ensureLoaded: loadIncome } = useIncome()

/** v-select can't hold null as a value: 'all' stands for "no filter". */
const ALL = 'all'
type Choice<T> = T | typeof ALL
/** "All categories" (no category key: keys are trimmed text). */
const ALL_COST_CATEGORIES = ' all'

interface FormState {
  title: string
  chartType: WidgetSettings['chartType']
  timeRange: WidgetSettings['timeRange']
  categoryId: Choice<number | 'none'>
  objectId: Choice<number>
  /** A category key, or ALL_COST_CATEGORIES. */
  costCategory: string
}

const form = reactive<FormState>({
  title: '',
  chartType: 'bar',
  timeRange: 'last-12-months',
  categoryId: ALL,
  objectId: ALL,
  costCategory: ALL_COST_CATEGORIES,
})
/** The category the widget was saved with (shown even when no cost has it any more). */
const savedCostCategory = ref<string | null>(null)

const type = computed(() => (props.widget ? findWidgetType(props.widget.type) : undefined))

/** The costs and income widgets: a doughnut splits by category, or by object when filtered. */
const splitsByCategory = computed<boolean>(() => type.value?.id === 'costs' || type.value?.id === 'income')

const chartOptions = computed(() =>
  (type.value?.supports.chartTypes ?? []).map((chart) => ({ title: chartTypeLabel(chart), value: chart })),
)
/** The categories of the costs (or of the income, for the income widget), and the saved one; the value is the key. */
const costCategoryOptions = computed(() => {
  const entries = type.value?.id === 'income' ? income.value : costs.value
  const used = categoriesOf([...entries, { category: savedCostCategory.value }])
  return [
    { title: t('dashboard.settings.allCostCategories'), value: ALL_COST_CATEGORIES },
    ...used.map(({ key, label }) => ({ title: label, value: key })),
  ]
})

/** The category to save: its label (as first entered), or null for all. */
function costCategoryOf(key: string): string | null {
  return costCategoryOptions.value.find((option) => option.value === key && key !== ALL_COST_CATEGORIES)?.title ?? null
}
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
    costCategory: settings.costCategory === null ? ALL_COST_CATEGORIES : categoryKey(settings.costCategory),
  } satisfies FormState)
  savedCostCategory.value = settings.costCategory
  submitError.value = null
}

/** Choices that are no longer offered (a deleted category or object, or an object outside the category) become "all". */
function dropStaleChoices(): void {
  if (!categoryOptions.value.some((option) => option.value === form.categoryId)) form.categoryId = ALL
  if (!objectOptions.value.some((option) => option.value === form.objectId)) form.objectId = ALL
}

async function prepareForm(widget: DashboardWidget): Promise<void> {
  resetForm(widget)
  await Promise.all([loadCategories(), loadObjects(), loadCosts(), loadIncome()])
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
    costCategory: costCategoryOf(form.costCategory),
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
        :hint="splitsByCategory ? t('dashboard.settings.doughnutHint') : undefined"
        :persistent-hint="splitsByCategory"
      />
      <v-select
        v-if="type.supports.costCategory"
        v-model="form.costCategory"
        :label="t('dashboard.settings.costCategory')"
        :items="costCategoryOptions"
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
