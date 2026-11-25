import type { TaxExportPlan, TaxExportResult } from '@/types/tax-export'
import { callCommand } from './native-command'

/**
 * The native export for a tax advisor (`src-tauri/src/tax_export/`): creates a new
 * folder inside `directory` (from a folder dialog) and carries out `plan` there.
 */
export function exportTaxFolder(directory: string, plan: TaxExportPlan): Promise<TaxExportResult> {
  return callCommand('export_tax_folder', { directory, plan })
}
