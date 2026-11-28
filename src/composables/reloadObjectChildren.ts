import { useAttachments } from './useAttachments'
import { useCosts } from './useCosts'
import { useIncome } from './useIncome'
import { useMaintenance } from './useMaintenance'
import { useRecurringCosts } from './useRecurringCosts'
import { useRecurringIncome } from './useRecurringIncome'

/**
 * Reloads everything that belongs to household objects (their child tables).
 * Deleting an object or a category, and a restore or import, change these rows
 * in the database (ON DELETE CASCADE / SET NULL), so their lists must be reloaded too.
 * A new child table's composable is added here, so every such place picks it up.
 */
export async function reloadObjectChildren(): Promise<void> {
  await Promise.all([
    useMaintenance().refresh(),
    useAttachments().refresh(),
    useCosts().refresh(),
    useRecurringCosts().refresh(),
    useIncome().refresh(),
    useRecurringIncome().refresh(),
  ])
}
