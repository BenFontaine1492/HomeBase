import { describe, expect, it } from 'vitest'
import type { Attachment, AttachmentOwner } from '@/types/attachment'
import type { Cost } from '@/types/cost'
import type { Income } from '@/types/income'
import {
  buildTaxExport,
  exportedCosts,
  exportedIncome,
  receiptsOf,
  receiptsOfIncome,
  safeName,
  type ExportSheet,
  type TaxExportInput,
} from '@/types/tax-export'

function cost(id: number, fields: Partial<Cost> = {}): Cost {
  return {
    id,
    paidDate: '2026-03-01',
    amountCents: 100_00,
    category: null,
    description: `Cost ${id}`,
    payee: null,
    paymentMethod: null,
    notes: null,
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

function income(id: number, fields: Partial<Income> = {}): Income {
  return {
    id,
    receivedDate: '2026-01-31',
    amountCents: 50_00,
    description: `Income ${id}`,
    payer: null,
    paymentMethod: null,
    category: 'Photovoltaik',
    notes: null,
    householdObjectId: null,
    recurringIncomeId: null,
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

const costs = [
  cost(1, { paidDate: '2026-05-10', category: 'Spenden', amountCents: 25_00, payee: 'DRK', paymentMethod: 'transfer' }),
  cost(2, {
    paidDate: '2026-03-02',
    category: 'Handwerkerleistungen',
    payee: 'Malerbetrieb Müller',
    amountCents: 500_00,
  }),
  cost(3, {
    paidDate: '2026-01-15',
    category: 'handwerkerleistungen',
    objectId: 7,
    notes: 'n',
    description: null,
    maintenanceRecordId: 9,
  }),
  cost(4, { paidDate: '2025-12-31' }),
  cost(5),
]

const attachments = [
  attachment(11, { kind: 'cost', id: 2 }),
  attachment(10, { kind: 'cost', id: 2 }, 'a0-0.jpg'),
  attachment(12, { kind: 'maintenance-record', id: 9 }, 'no-extension'),
  attachment(13, { kind: 'object', id: 7 }),
]

const input: TaxExportInput = {
  year: 2026,
  includeCosts: true,
  includeIncome: false,
  costs,
  income: [],
  attachments,
  titleOf: (c) => c.description ?? 'Maintenance',
  objectNameOf: (id) => (id === null ? null : 'Heat pump'),
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
  it('takes all costs of the year, by category (those without one last), then by date', () => {
    expect(exportedCosts(input).map(({ cost: c, entry }) => [c.id, entry.name, entry.folder])).toEqual([
      [3, 'Handwerkerleistungen', 'Handwerkerleistungen'],
      [2, 'Handwerkerleistungen', 'Handwerkerleistungen'],
      [1, 'Spenden', 'Spenden'],
      [5, 'No category', 'No category'],
    ])
  })

  it('leaves the costs out when they are not selected', () => {
    expect(exportedCosts({ ...input, includeCosts: false })).toEqual([])
  })

  it('keeps costs of the same day in the order they were entered', () => {
    const sameDay = [cost(9), cost(8)]
    expect(exportedCosts({ ...input, costs: sameDay }).map(({ cost: c }) => c.id)).toEqual([8, 9])
  })

  it('gives every category its own folder, even with the same safe name', () => {
    const twins = [cost(1, { category: 'A/B' }), cost(2, { category: 'a-b' }), cost(3, { category: '???' })]
    const folders = exportedCosts({ ...input, costs: twins }).map(({ entry }) => entry.folder)
    expect(new Set(folders).size).toBe(3)
    expect(folders).toContain('___')
    expect(folders.some((folder) => folder.endsWith(' (2)'))).toBe(true)
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
      'A list of what was entered in HomeBase, without any tax assessment.',
    ])
    expect(plan.sheets.map((sheet) => sheet.name)).toEqual(['Costs', 'Totals'])
    expect(totalsSheet.title[0]).toBe('Totals 2026')
  })

  it('numbers the receipts after their row, in one folder per category', () => {
    expect(plan.receipts).toEqual([
      { attachmentId: 12, folder: 'Handwerkerleistungen', fileName: '001_2026-01-15_Maintenance' },
      { attachmentId: 10, folder: 'Handwerkerleistungen', fileName: '002_2026-03-02_Malerbetrieb Müller.jpg' },
      { attachmentId: 11, folder: 'Handwerkerleistungen', fileName: '002_2026-03-02_Malerbetrieb Müller_2.pdf' },
    ])
    expect(summary).toEqual({
      costCount: 4,
      costTotalCents: 725_00,
      incomeCount: 0,
      incomeTotalCents: 0,
      receiptCount: 3,
      withoutReceiptCount: 2,
    })
  })

  it('lists every cost with its receipts, and the total', () => {
    expect(costSheet.columns.map((column) => column.label)).toEqual([
      'No.',
      'Date',
      'Category',
      'Description',
      'Paid to',
      'Amount',
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
        { amount: 100_00 },
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
        { amount: 500_00 },
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
        { amount: 25_00 },
        'Bank transfer',
        null,
        null,
        'no receipt',
      ],
      [
        { number: 4 },
        { date: '2026-03-01' },
        'No category',
        'Cost 5',
        null,
        { amount: 100_00 },
        null,
        null,
        null,
        'no receipt',
      ],
    ])
    expect(costSheet.footer).toEqual([[null, null, null, 'Total', null, { amount: 725_00 }]])
  })

  it('sums per category', () => {
    expect(totalsSheet.columns.map((column) => column.label)).toEqual(['Category', 'Count', 'Amount'])
    expect(totalsSheet.rows).toEqual([
      ['Handwerkerleistungen', { number: 2 }, { amount: 600_00 }],
      ['Spenden', { number: 1 }, { amount: 25_00 }],
      ['No category', { number: 1 }, { amount: 100_00 }],
    ])
    expect(totalsSheet.footer).toEqual([['Total', { number: 4 }, { amount: 725_00 }]])
  })
})

describe('income', () => {
  const entries = [
    income(1, { receivedDate: '2026-02-28', payer: 'Netzbetreiber', paymentMethod: 'transfer', householdObjectId: 7 }),
    income(2, { category: 'photovoltaik', notes: 'n' }),
    income(3, { category: 'Miete', amountCents: 800_00 }),
    income(4, { category: null, amountCents: 20_00 }),
    income(5, { receivedDate: '2025-12-31' }),
    income(6, { category: 'A/B' }),
  ]
  const incomeAttachments = [
    attachment(21, { kind: 'income', id: 1 }),
    attachment(20, { kind: 'income', id: 1 }, 'b1-0.jpg'),
    attachment(22, { kind: 'cost', id: 1 }),
  ]
  const withIncome: TaxExportInput = {
    ...input,
    includeIncome: true,
    income: entries,
    // Without the cost document: it would give cost 1 a receipt.
    attachments: [...attachments, ...incomeAttachments.slice(0, 2)],
  }

  it('takes all income of the year, by category, then date, each category in the income folder', () => {
    expect(exportedIncome(input)).toEqual([])
    expect(exportedIncome(withIncome).map(({ income: e, entry }) => [e.id, entry.name, entry.folder])).toEqual([
      [6, 'A/B', 'Income/A-B'],
      [3, 'Miete', 'Income/Miete'],
      [2, 'Photovoltaik', 'Income/Photovoltaik'],
      [1, 'Photovoltaik', 'Income/Photovoltaik'],
      [4, 'No category', 'Income/No category'],
    ])
  })

  it('takes the documents of an income entry, oldest first', () => {
    expect(receiptsOfIncome(entries[0] as Income, incomeAttachments).map((a) => a.id)).toEqual([20, 21])
  })

  it('adds an income sheet and an income part to the totals, named after both', () => {
    const { plan, summary } = buildTaxExport(withIncome, formats)
    expect(plan.workbookName).toBe('Income and costs 2026.xlsx')
    expect(plan.sheets.map((sheet) => sheet.name)).toEqual(['Costs', 'Income', 'Totals'])
    const [, incomeSheet, totals] = plan.sheets as [ExportSheet, ExportSheet, ExportSheet]
    expect(incomeSheet.title[0]).toBe('Income 2026')
    expect(incomeSheet.columns.map((column) => column.label)).toEqual([
      'No.',
      'Date',
      'Category',
      'Description',
      'Received from',
      'Amount',
      'Payment method',
      'Object',
      'Notes',
      'Receipt',
    ])
    expect(incomeSheet.rows[3]).toEqual([
      { number: 4 },
      { date: '2026-02-28' },
      'Photovoltaik',
      'Income 1',
      'Netzbetreiber',
      { amount: 50_00 },
      'Bank transfer',
      'Heat pump',
      null,
      'Income/Photovoltaik/004_2026-02-28_Netzbetreiber.jpg\nIncome/Photovoltaik/004_2026-02-28_Netzbetreiber_2.pdf',
    ])
    expect(incomeSheet.rows[2]?.[8]).toBe('n')
    expect(incomeSheet.rows[4]?.[9]).toBe('no receipt')
    expect(incomeSheet.footer).toEqual([[null, null, null, 'Total', null, { amount: 970_00 }]])

    expect(totals.rows).toEqual([
      ['Costs'],
      ['Handwerkerleistungen', { number: 2 }, { amount: 600_00 }],
      ['Spenden', { number: 1 }, { amount: 25_00 }],
      ['No category', { number: 1 }, { amount: 100_00 }],
      [],
      ['Income'],
      ['A/B', { number: 1 }, { amount: 50_00 }],
      ['Miete', { number: 1 }, { amount: 800_00 }],
      ['Photovoltaik', { number: 2 }, { amount: 100_00 }],
      ['No category', { number: 1 }, { amount: 20_00 }],
    ])
    expect(totals.footer).toEqual([
      ['Total costs', { number: 4 }, { amount: 725_00 }],
      ['Total income', { number: 5 }, { amount: 970_00 }],
    ])
    expect(summary).toEqual({
      costCount: 4,
      costTotalCents: 725_00,
      incomeCount: 5,
      incomeTotalCents: 970_00,
      receiptCount: 5,
      withoutReceiptCount: 6,
    })
  })

  it('exports income alone', () => {
    const { plan, summary } = buildTaxExport({ ...withIncome, includeCosts: false }, formats)
    expect(plan.workbookName).toBe('Income 2026.xlsx')
    expect(plan.sheets.map((sheet) => sheet.name)).toEqual(['Income', 'Totals'])
    const totals = plan.sheets[1] as ExportSheet
    expect(totals.rows[0]).toEqual(['A/B', { number: 1 }, { amount: 50_00 }])
    expect(totals.footer).toEqual([['Total', { number: 5 }, { amount: 970_00 }]])
    expect(summary.costCount).toBe(0)
  })

  it('keeps a cost folder apart from the income folder', () => {
    const named = [cost(2, { category: 'Income' })]
    const { plan } = buildTaxExport({ ...withIncome, costs: named }, formats)
    expect(plan.receipts.map((receipt) => receipt.folder)).toContain('Income (2)')
  })
})
