import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), transaction: vi.fn() }))

import { select, transaction } from '@/infrastructure/database'
import * as repository from '@/repositories/dashboard-widget.repository'
import { DashboardWidgetValues } from '@/types/dashboard'

describe('findAll', () => {
  it('maps rows in display order and reads the settings', async () => {
    vi.mocked(select).mockResolvedValue([
      { id: 4, widget_type: 'recent-objects', position: 0, size: 'small', title: null, settings: '{"categoryId":2}' },
    ])
    await expect(repository.findAll()).resolves.toEqual([
      {
        id: 4,
        type: 'recent-objects',
        position: 0,
        size: 'small',
        title: null,
        settings: { chartType: 'bar', timeRange: 'last-12-months', categoryId: 2, objectId: null, costCategory: null },
      },
    ])
    expect(select).toHaveBeenCalledWith(expect.stringContaining('ORDER BY position ASC, id ASC'))
  })
})

describe('replaceAll', () => {
  it('deletes and re-inserts the layout in one transaction, in list order', async () => {
    vi.mocked(transaction).mockResolvedValue([])
    await repository.replaceAll([
      DashboardWidgetValues.from({ type: 'recent-objects', size: 'small', title: 'New' }),
      DashboardWidgetValues.from({ type: 'planned-investments', size: 'medium' }),
    ])
    const [statements] = vi.mocked(transaction).mock.calls[0]!
    expect(statements[0]).toEqual({ sql: 'DELETE FROM dashboard_widgets', params: [] })
    expect(statements.slice(1).map((statement) => statement.params)).toEqual([
      ['recent-objects', 0, 'small', 'New', '{"categoryId":null}'],
      ['planned-investments', 1, 'medium', null, '{"chartType":"pie"}'],
    ])
  })

  it('empties the layout when the list is empty', async () => {
    vi.mocked(transaction).mockResolvedValue([])
    await repository.replaceAll([])
    expect(vi.mocked(transaction).mock.calls[0]![0]).toHaveLength(1)
  })
})
