import * as taxExportService from '@/services/tax-export.service'
import {
  buildTaxExport,
  type ExportGroup,
  type TaxExportPlan,
  type TaxExportResult,
  type TaxExportSummary,
} from '@/types/tax-export'
import { formatDate, todayIsoDate } from '@/utils/date'
import { excelCurrencyFormat, excelDateFormat } from '@/utils/excel-format'
import { useAttachments } from './useAttachments'
import { useCosts } from './useCosts'
import { useHouseholdObjects } from './useHouseholdObjects'
import { useTaxCategories } from './useTaxCategories'

/*
 * The export for a tax advisor (no shared state). The plan is built from the
 * loaded lists; the dialog shows its summary before the user picks a folder.
 */

/** Loads everything the export reads. */
async function ensureLoaded(): Promise<void> {
  await Promise.all([useCosts().ensureLoaded(), useAttachments().ensureLoaded(), useHouseholdObjects().ensureLoaded()])
}

/** The export of `year` with the costs in `groups`, as of now. */
function prepare(year: number, groups: readonly ExportGroup[]): { plan: TaxExportPlan; summary: TaxExportSummary } {
  const { costs, titleOf } = useCosts()
  const { findObject } = useHouseholdObjects()
  return buildTaxExport(
    {
      year,
      groups,
      costs: costs.value,
      categories: useTaxCategories().categories.value,
      attachments: useAttachments().attachments.value,
      titleOf,
      objectNameOf: (cost) => (cost.objectId === null ? null : (findObject(cost.objectId)?.name ?? null)),
    },
    { createdOn: formatDate(todayIsoDate()), currencyFormat: excelCurrencyFormat(), dateFormat: excelDateFormat() },
  )
}

/** Lets the user pick a folder, then writes the export into a new folder there. null = cancelled. */
async function exportFolder(year: number, groups: readonly ExportGroup[]): Promise<TaxExportResult | null> {
  const directory = await taxExportService.pickExportFolder()
  if (directory === null) return null
  return taxExportService.exportTaxFolder(directory, prepare(year, groups).plan)
}

export interface UseTaxExport {
  ensureLoaded: () => Promise<void>
  summaryOf: (year: number, groups: readonly ExportGroup[]) => TaxExportSummary
  exportFolder: (year: number, groups: readonly ExportGroup[]) => Promise<TaxExportResult | null>
}

export function useTaxExport(): UseTaxExport {
  return {
    ensureLoaded,
    summaryOf: (year, groups) => prepare(year, groups).summary,
    exportFolder,
  }
}
