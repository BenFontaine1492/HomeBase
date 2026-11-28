import * as taxExportService from '@/services/tax-export.service'
import {
  buildTaxExport,
  type TaxExportPlan,
  type TaxExportSelection,
  type TaxExportResult,
  type TaxExportSummary,
} from '@/types/tax-export'
import { formatDate, todayIsoDate } from '@/utils/date'
import { excelCurrencyFormat, excelDateFormat } from '@/utils/excel-format'
import { useAttachments } from './useAttachments'
import { useCosts } from './useCosts'
import { useHouseholdObjects } from './useHouseholdObjects'
import { useIncome } from './useIncome'

/*
 * The export for a tax advisor (no shared state). The plan is built from the
 * loaded lists; the dialog shows its summary before the user picks a folder.
 */

/** Loads everything the export reads. */
async function ensureLoaded(): Promise<void> {
  await Promise.all([
    useCosts().ensureLoaded(),
    useIncome().ensureLoaded(),
    useAttachments().ensureLoaded(),
    useHouseholdObjects().ensureLoaded(),
  ])
}

/** The export of what `selection` asks for, as of now. */
function prepare(selection: TaxExportSelection): { plan: TaxExportPlan; summary: TaxExportSummary } {
  const { costs, titleOf } = useCosts()
  const { findObject } = useHouseholdObjects()
  return buildTaxExport(
    {
      ...selection,
      costs: costs.value,
      income: useIncome().income.value,
      attachments: useAttachments().attachments.value,
      titleOf,
      objectNameOf: (id) => (id === null ? null : (findObject(id)?.name ?? null)),
    },
    { createdOn: formatDate(todayIsoDate()), currencyFormat: excelCurrencyFormat(), dateFormat: excelDateFormat() },
  )
}

/** Lets the user pick a folder, then writes the export into a new folder there. null = cancelled. */
async function exportFolder(selection: TaxExportSelection): Promise<TaxExportResult | null> {
  const directory = await taxExportService.pickExportFolder()
  if (directory === null) return null
  return taxExportService.exportTaxFolder(directory, prepare(selection).plan)
}

export interface UseTaxExport {
  ensureLoaded: () => Promise<void>
  summaryOf: (selection: TaxExportSelection) => TaxExportSummary
  exportFolder: (selection: TaxExportSelection) => Promise<TaxExportResult | null>
}

export function useTaxExport(): UseTaxExport {
  return {
    ensureLoaded,
    summaryOf: (selection) => prepare(selection).summary,
    exportFolder,
  }
}
