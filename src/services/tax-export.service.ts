import { open } from '@tauri-apps/plugin-dialog'
import { t } from '@/i18n'
import * as repository from '@/repositories/tax-export.repository'
import type { TaxExportPlan, TaxExportResult } from '@/types/tax-export'

/*
 * The export for a tax advisor: the user picks a folder, HomeBase creates a new
 * folder inside it with the workbook and the receipts (see types/tax-export.ts).
 */

/** Lets the user pick the folder the export is created in. null = cancelled. */
export async function pickExportFolder(): Promise<string | null> {
  const path = await open({ title: t('taxExport.chooseFolder'), multiple: false, directory: true })
  return typeof path === 'string' ? path : null
}

export function exportTaxFolder(directory: string, plan: TaxExportPlan): Promise<TaxExportResult> {
  return repository.exportTaxFolder(directory, plan)
}
