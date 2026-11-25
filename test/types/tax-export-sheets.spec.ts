import { describe, expect, it } from 'vitest'
import { entrySheet, totalsSheet, type SheetContext } from '@/types/tax-export-sheets'

/* The sheets with their rows are tested through buildTaxExport (tax-export.spec.ts). */

const context: SheetContext = { year: 2026, includeCosts: true, includeIncome: true, createdOn: '22.11.2026' }

describe('sheets without rows', () => {
  it('have their title, columns and a zero total', () => {
    const costs = entrySheet('costs', [], context)
    expect(costs.title).toEqual([
      'Costs 2026',
      'Created on 22.11.2026 with HomeBase',
      'A list of what was entered in HomeBase, without any tax assessment.',
    ])
    expect(costs.rows).toEqual([])
    expect(costs.footer).toEqual([[null, null, null, 'Total', null, { amount: 0 }]])
    expect(entrySheet('income', [], context).columns[4]?.label).toBe('Received from')
  })

  it('keep both parts of the totals, with a zero total each', () => {
    const totals = totalsSheet([], [], context)
    expect(totals.rows).toEqual([['Costs'], [], ['Income']])
    expect(totals.footer).toEqual([
      ['Total costs', { number: 0 }, { amount: 0 }],
      ['Total income', { number: 0 }, { amount: 0 }],
    ])
  })
})
