<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useNotifications } from '@/composables/useNotifications'
import { useTaxCategories } from '@/composables/useTaxCategories'
import { useTaxExport } from '@/composables/useTaxExport'
import { t } from '@/i18n'
import { TAXES, taxesGroupLabel } from '@/types/cost'
import type { ExportGroup, TaxExportSummary } from '@/types/tax-export'
import { formatCents } from '@/utils/currency'

/**
 * "Export for tax advisor": the tax year and the categories, then a folder. HomeBase
 * creates a new folder there with a workbook of the costs and their receipts.
 */
const props = defineProps<{
  /** Preselected tax year. */
  year: number
  years: readonly number[]
}>()

const open = defineModel<boolean>({ required: true })

const { categories } = useTaxCategories()
const { ensureLoaded, summaryOf, exportFolder } = useTaxExport()
const { notify } = useNotifications()
const { isRunning, error, run } = useAsyncAction()

const selectedYear = ref(props.year)
const selectedGroups = ref<ExportGroup[]>([])
/** Receipts whose files were missing in the last export. */
const missing = ref<string[]>([])

/** The tax categories, then the taxes and fees (cost type 'tax'). */
const groupOptions = computed<{ value: ExportGroup; label: string }[]>(() => [
  ...categories.value.map((category) => ({ value: category.id, label: category.name })),
  { value: TAXES, label: taxesGroupLabel() },
])
const summary = computed<TaxExportSummary>(() => summaryOf(selectedYear.value, selectedGroups.value))

watch(open, (isOpen) => {
  if (!isOpen) return
  void ensureLoaded()
  selectedYear.value = props.year
  selectedGroups.value = groupOptions.value.map((option) => option.value)
  missing.value = []
  error.value = null
})

function startExport(): Promise<void> {
  missing.value = []
  return run(async () => {
    const result = await exportFolder(selectedYear.value, selectedGroups.value)
    if (result === null) return
    notify(t('taxExport.done', { folder: result.folder }))
    if (result.missing.length > 0) missing.value = result.missing
    else open.value = false
  })
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="t('taxExport.title')"
    :subtitle="t('taxExport.subtitle')"
    :busy="isRunning"
    size="medium"
  >
    <v-select v-model="selectedYear" :label="t('taxExport.year')" :items="[...years]" />

    <div class="hb-body-strong mb-1">{{ t('taxExport.categories') }}</div>
    <p v-if="categories.length === 0" class="hb-caption text-medium-emphasis">{{ t('taxExport.noCategories') }}</p>
    <v-checkbox
      v-for="option in groupOptions"
      :key="option.value"
      :model-value="selectedGroups"
      :value="option.value"
      :label="option.label"
      density="compact"
      hide-details
      @update:model-value="(groups: ExportGroup[] | null) => (selectedGroups = groups ?? [])"
    />

    <v-alert type="info" density="compact" class="mt-4">
      {{
        t('taxExport.summary', {
          count: summary.costCount,
          total: formatCents(summary.totalCents),
          receipts: summary.receiptCount,
        })
      }}
      <template v-if="summary.withoutReceiptCount > 0">
        {{ t('taxExport.withoutReceipt', { count: summary.withoutReceiptCount }) }}
      </template>
    </v-alert>
    <p class="hb-caption text-medium-emphasis mt-2">{{ t('taxExport.hint') }}</p>

    <v-alert v-if="missing.length > 0" type="warning" density="compact" class="mt-4">
      {{ t('taxExport.missing', { count: missing.length }) }}
      <ul class="mt-1 ml-4">
        <li v-for="file in missing" :key="file">{{ file }}</li>
      </ul>
    </v-alert>
    <v-alert v-if="error" type="error" density="compact" class="mt-4">{{ error }}</v-alert>

    <template #actions>
      <v-btn
        color="primary"
        variant="flat"
        :text="t('taxExport.export')"
        :loading="isRunning"
        :disabled="summary.costCount === 0"
        v-bind="{ onClick: startExport }"
      />
      <v-btn :disabled="isRunning" :text="t('common.close')" v-bind="{ onClick: () => (open = false) }" />
    </template>
  </AppDialog>
</template>
