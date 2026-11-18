import { useAttachments } from './useAttachments'
import { useMaintenance } from './useMaintenance'

/**
 * Reloads everything that belongs to household objects (their child tables).
 * Deleting an object or a category, and a restore or import, change these rows
 * in the database (ON DELETE CASCADE), so their lists must be reloaded too.
 * A new child table's composable is added here, so every such place picks it up.
 */
export async function reloadObjectChildren(): Promise<void> {
  await Promise.all([useMaintenance().refresh(), useAttachments().refresh()])
}
