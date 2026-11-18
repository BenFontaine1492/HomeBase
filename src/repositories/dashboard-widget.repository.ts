import { select, transaction, type SqlStatement } from '@/infrastructure/database'
import {
  widgetSettingsFrom,
  type DashboardWidget,
  type DashboardWidgetValues,
  type WidgetSize,
} from '@/types/dashboard'

/** Row shape as stored in SQLite (snake_case columns). */
interface DashboardWidgetRow {
  id: number
  widget_type: string
  position: number
  size: WidgetSize
  title: string | null
  settings: string
}

function mapRow(row: DashboardWidgetRow): DashboardWidget {
  return {
    id: row.id,
    type: row.widget_type,
    position: row.position,
    size: row.size,
    title: row.title,
    settings: widgetSettingsFrom(row.widget_type, row.settings),
  }
}

/** All widgets in display order. */
export async function findAll(): Promise<DashboardWidget[]> {
  const rows = await select<DashboardWidgetRow>(
    `SELECT id, widget_type, position, size, title, settings
       FROM dashboard_widgets
      ORDER BY position ASC, id ASC`,
  )
  return rows.map(mapRow)
}

/**
 * Replaces the whole layout in one transaction; the list order becomes the
 * display order. Saving the whole list keeps `position` unique without renumbering.
 */
export async function replaceAll(widgets: readonly DashboardWidgetValues[]): Promise<void> {
  const inserts = widgets.map((widget, position): SqlStatement => ({
    sql: `INSERT INTO dashboard_widgets (widget_type, position, size, title, settings)
            VALUES ($1, $2, $3, $4, $5)`,
    params: [widget.type, position, widget.size, widget.title, widget.settingsJson],
  }))
  await transaction([{ sql: 'DELETE FROM dashboard_widgets', params: [] }, ...inserts])
}
