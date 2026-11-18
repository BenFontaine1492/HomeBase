import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/dashboard-widget.repository', () => ({ findAll: vi.fn(), replaceAll: vi.fn() }))

import * as repository from '@/repositories/dashboard-widget.repository'
import { listWidgets, resetLayout, saveLayout } from '@/services/dashboard.service'
import { DEFAULT_DASHBOARD, DashboardWidgetValues } from '@/types/dashboard'

describe('listWidgets', () => {
  it('returns the widgets from the repository', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([])
    await expect(listWidgets()).resolves.toEqual([])
  })
})

describe('saveLayout', () => {
  it('passes validated value objects in list order', async () => {
    await saveLayout([
      { type: 'recent-objects', size: 'small', title: ' New ' },
      { type: 'inventory-overview', size: 'large' },
    ])
    const [values] = vi.mocked(repository.replaceAll).mock.calls[0]!
    expect(values.map((widget) => [widget.type, widget.title])).toEqual([
      ['recent-objects', 'New'],
      ['inventory-overview', null],
    ])
    expect(values[0]).toBeInstanceOf(DashboardWidgetValues)
  })

  it('saves nothing when one widget is invalid', async () => {
    await expect(
      saveLayout([
        { type: 'recent-objects', size: 'small' },
        { type: 'future-widget', size: 'small' },
      ]),
    ).rejects.toThrow('Unknown widget type "future-widget".')
    expect(repository.replaceAll).not.toHaveBeenCalled()
  })
})

describe('resetLayout', () => {
  it('saves the default layout', async () => {
    await resetLayout()
    const [values] = vi.mocked(repository.replaceAll).mock.calls[0]!
    expect(values.map((widget) => widget.type)).toEqual(DEFAULT_DASHBOARD.map((widget) => widget.type))
  })
})
