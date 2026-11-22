import { describe, expect, it } from 'vitest'
import type { Attachment, AttachmentOwner } from '@/types/attachment'
import { TAXES, type Cost } from '@/types/cost'
import type { TaxCategory } from '@/types/tax-category'
import {
  buildTaxExport,
  exportedCosts,
  receiptsOf,
  safeName,
  type ExportSheet,
  type TaxExportInput,
} from '@/types/tax-export'

function category(id: number, name: string, recordsLabourCost = false): TaxCategory {
  return { id, name, recordsLabourCost, sortOrder: id, createdAt: '', updatedAt: '' }
}

function cost(id: number, fields: Partial<Cost> = {}): Cost {
  return {
    id,
    paidDate: '2026-03-01',
    amountCents: 100_00,
    labourCents: null,
    costType: 'repair',
    description: `Cost ${id}`,
    payee: null,
    paymentMethod: null,
    notes: null,
    taxCategoryId: 1,
    householdObjectId: null,
    maintenanceRecordId: null,
    investmentId: null,
    recurringCostId: null,
    objectId: null,
    createdAt: '',
    updatedAt: '',
    ...fields,
  }
}

function attachment(id: number, owner: AttachmentOwner, storedName = `${id}.pdf`): Attachment {
  return {
    id,
    owner,
    storedName,
    originalName: 'x.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1,
    documentType: 'invoice',
    documentDate: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
  }
}

const craft = category(1, 'Handwerkerleistungen', true)
const donations = category(2, 'Spenden')
const office = category(3, 'Arbeitszimmer / Homeoffice')

const costs = [
  cost(1, { paidDate: '2026-05-10', taxCategoryId: 2, amountCents: 25_00, payee: 'DRK', paymentMethod: 'transfer' }),
  cost(2, { paidDate: '2026-03-02', payee: 'Malerbetrieb Müller', labourCents: 300_00, amountCents: 500_00 }),
  cost(3, { paidDate: '2026-01-15', objectId: 7, notes: 'n', description: null, maintenanceRecordId: 9 }),
  cost(4, { paidDate: '2025-12-31' }),
  cost(5, { taxCategoryId: null }),
  cost(6, { taxCategoryId: 3 }),
  cost(7, { taxCategoryId: 99 }),
]

const attachments = [
  attachment(11, { kind: 'cost', id: 2 }),
  attachment(10, { kind: 'cost', id: 2 }, 'a0-0.jpg'),
  attachment(12, { kind: 'maintenance-record', id: 9 }, 'no-extension'),
  attachment(13, { kind: 'object', id: 7 }),
]

const input: TaxExportInput = {
  year: 2026,
  groups: [1, 2],
  costs,
  categories: [craft, donations, office],
  attachments,
  titleOf: (c) => c.description ?? 'Maintenance',
  objectNameOf: (c) => (c.objectId === null ? null : 'Heat pump'),
}

const formats = { createdOn: '22.11.2026', currencyFormat: '#,##0.00 "€"', dateFormat: 'dd.mm.yyyy' }

describe('safeName', () => {
  it.each([
    ['Arbeitszimmer / Homeoffice', 'Arbeitszimmer - Homeoffice'],
    ['a\\b', 'a-b'],
    ['Rechnung: 4711?', 'Rechnung_ 4711_'],
    ['  many   spaces\n', 'many spaces'],
    ['...hidden', 'hidden'],
    ['trailing. . ', 'trailing'],
    ['con', 'con_'],
    ['LPT1.txt', 'LPT1.txt_'],
    ['   ', 'Fallback'],
    ['x'.repeat(80), 'x'.repeat(60)],
  ])('%j → %j', (text, expected) => {
    expect(safeName(text, 'Fallback')).toBe(expected)
  })
})

describe('exportedCosts', () => {
  it('takes the costs of the year with a selected category, by category, then date', () => {
    expect(exportedCosts(input).map(({ cost: c }) => c.id)).toEqual([3, 2, 1])
  })

  it('puts the taxes and fees (cost type tax) after the categories, when selected', () => {
    const taxes = [cost(20, { costType: 'tax', taxCategoryId: null }), cost(21, { paidDate: '2026-12-01' })]
    const withTaxes = exportedCosts({ ...input, costs: taxes, groups: [TAXES, 1] })
    expect(withTaxes.map(({ cost: c, entry }) => [c.id, entry.name, entry.folder])).toEqual([
      [21, 'Handwerkerleistungen', 'Handwerkerleistungen'],
      [20, 'Taxes and fees', 'Taxes and fees'],
    ])
    expect(exportedCosts({ ...input, costs: taxes }).map(({ cost: c }) => c.id)).toEqual([21])
  })

  it('keeps costs of the same day in the order they were entered', () => {
    const sameDay = [cost(9), cost(8)]
    expect(exportedCosts({ ...input, costs: sameDay }).map(({ cost: c }) => c.id)).toEqual([8, 9])
  })
})

describe('receiptsOf', () => {
  it('takes the cost’s own documents and those of its maintenance record, oldest first', () => {
    expect(receiptsOf(cost(2), attachments).map((a) => a.id)).toEqual([10, 11])
    expect(receiptsOf(cost(3, { maintenanceRecordId: 9 }), attachments).map((a) => a.id)).toEqual([12])
  })
})

describe('buildTaxExport', () => {
  const { plan, summary } = buildTaxExport(input, formats)
  const [costSheet, totalsSheet] = plan.sheets as [ExportSheet, ExportSheet]

  it('names the folder and the workbook after the year', () => {
    expect(plan).toMatchObject({
      folderName: 'HomeBase Tax 2026',
      workbookName: 'Costs 2026.xlsx',
      currencyFormat: '#,##0.00 "€"',
      dateFormat: 'dd.mm.yyyy',
    })
    expect(costSheet.title).toEqual([
      'Costs 2026',
      'Created on 22.11.2026 with HomeBase',
      'A list of the costs entered in HomeBase, without any tax assessment.',
    ])
  })

  it('numbers the receipts after their row, in one folder per category', () => {
    expect(plan.receipts).toEqual([
      { attachmentId: 12, folder: 'Handwerkerleistungen', fileName: '001_2026-01-15_Maintenance' },
      { attachmentId: 10, folder: 'Handwerkerleistungen', fileName: '002_2026-03-02_Malerbetrieb Müller.jpg' },
      { attachmentId: 11, folder: 'Handwerkerleistungen', fileName: '002_2026-03-02_Malerbetrieb Müller_2.pdf' },
    ])
    expect(summary).toEqual({ costCount: 3, receiptCount: 3, withoutReceiptCount: 1, totalCents: 625_00 })
  })

  it('lists every cost with its receipts, and the total', () => {
    expect(costSheet.columns.map((column) => column.label)).toEqual([
      'No.',
      'Date',
      'Tax category',
      'Description',
      'Paid to',
      'Type',
      'Amount',
      'Of which labour',
      'Payment method',
      'Object',
      'Notes',
      'Receipt',
    ])
    expect(costSheet.rows).toEqual([
      [
        { number: 1 },
        { date: '2026-01-15' },
        'Handwerkerleistungen',
        'Maintenance',
        null,
        'Repair',
        { amount: 100_00 },
        null,
        null,
        'Heat pump',
        'n',
        {
          link: 'Handwerkerleistungen/001_2026-01-15_Maintenance',
          text: 'Handwerkerleistungen/001_2026-01-15_Maintenance',
        },
      ],
      [
        { number: 2 },
        { date: '2026-03-02' },
        'Handwerkerleistungen',
        'Cost 2',
        'Malerbetrieb Müller',
        'Repair',
        { amount: 500_00 },
        { amount: 300_00 },
        null,
        null,
        null,
        'Handwerkerleistungen/002_2026-03-02_Malerbetrieb Müller.jpg\nHandwerkerleistungen/002_2026-03-02_Malerbetrieb Müller_2.pdf',
      ],
      [
        { number: 3 },
        { date: '2026-05-10' },
        'Spenden',
        'Cost 1',
        'DRK',
        'Repair',
        { amount: 25_00 },
        null,
        'Bank transfer',
        null,
        null,
        'no receipt',
      ],
    ])
    expect(costSheet.footer).toEqual([[null, null, null, 'Total', null, null, { amount: 625_00 }, { amount: 300_00 }]])
  })

  it('sums per category', () => {
    expect(totalsSheet.columns.map((column) => column.label)).toEqual([
      'Tax category',
      'Count',
      'Amount',
      'Of which labour',
    ])
    expect(totalsSheet.rows).toEqual([
      ['Handwerkerleistungen', { number: 2 }, { amount: 600_00 }, { amount: 300_00 }],
      ['Spenden', { number: 1 }, { amount: 25_00 }, { amount: 0 }],
    ])
    expect(totalsSheet.footer).toEqual([['Total', { number: 3 }, { amount: 625_00 }, { amount: 300_00 }]])
  })

  it('leaves out the labour columns when no exported category records labour', () => {
    const { plan: donationsOnly } = buildTaxExport({ ...input, groups: [2] }, formats)
    const [sheet, totals] = donationsOnly.sheets as [ExportSheet, ExportSheet]
    expect(sheet.columns.map((column) => column.label)).not.toContain('Of which labour')
    expect(sheet.footer).toEqual([[null, null, null, 'Total', null, null, { amount: 25_00 }]])
    expect(totals.columns).toHaveLength(3)
  })

  it('gives every category its own folder, even with the same safe name', () => {
    const twins = [category(1, 'A/B'), category(2, 'a-b'), category(3, '???')]
    const { plan: twinPlan } = buildTaxExport(
      {
        ...input,
        categories: twins,
        groups: [1, 2, 3],
        costs: [cost(1, { taxCategoryId: 1 }), cost(2, { taxCategoryId: 2 }), cost(3, { taxCategoryId: 3 })],
        attachments: [1, 2, 3].map((id) => attachment(id, { kind: 'cost', id })),
      },
      formats,
    )
    expect(twinPlan.receipts.map((receipt) => receipt.folder)).toEqual(['A-B', 'a-b (2)', '___'])
  })
})
