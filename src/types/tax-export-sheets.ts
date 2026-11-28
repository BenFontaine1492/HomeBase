import { t } from '@/i18n'
import { paymentMethodLabel, type PaymentMethod } from './cost'

/*
 * The sheets of the export workbook for a tax advisor (see tax-export.ts): the
 * costs, the income and the totals, as cells the native side writes
 * (src-tauri/src/tax_export/workbook.rs). Costs and income are rows of the same
 * shape, grouped by category. Pure: the texts are translated here.
 */

/** A workbook cell: empty, text, a number, an amount in cents, a date or a link to a file in the folder. */
export type ExportCell =
  | null
  | string
  | { number: number }
  | { amount: number }
  | { date: string }
  | { link: string; text: string }

export interface ExportColumn {
  label: string
  /** In characters. */
  width: number
}

export interface ExportSheet {
  name: string
  /** Lines above the table; the first one is the heading. */
  title: string[]
  columns: ExportColumn[]
  rows: ExportCell[][]
  /** Rows after the table, in bold (the total). */
  footer: ExportCell[][]
}

/** Attachment `attachmentId` is copied to `<folder>/<fileName>`; `folder` may have parts joined by '/'. */
export interface ExportReceipt {
  attachmentId: number
  folder: string
  fileName: string
}

/** A category of rows and its receipt folder in the export. */
export interface ExportEntry {
  name: string
  /** Relative to the export folder; parts joined by '/'. */
  folder: string
}

/** One cost or income entry of the export. */
export interface ExportRow {
  entry: ExportEntry
  /** 'YYYY-MM-DD' */
  date: string
  description: string
  /** Who was paid (costs) or who paid (income). */
  party: string | null
  amountCents: number
  paymentMethod: PaymentMethod | null
  objectName: string | null
  notes: string | null
  receipts: ExportReceipt[]
}

/** What every sheet is built from. */
export interface SheetContext {
  year: number
  includeCosts: boolean
  includeIncome: boolean
  /** The creation date, formatted for the heading. */
  createdOn: string
}

export type ExportKind = 'costs' | 'income'

type ColumnKey =
  | 'number'
  | 'date'
  | 'category'
  | 'description'
  | 'payee'
  | 'payer'
  | 'amount'
  | 'paymentMethod'
  | 'object'
  | 'notes'
  | 'receipt'
  | 'count'

function column(key: ColumnKey, width: number): ExportColumn {
  return { label: t(`taxExport.columns.${key}`), width }
}

function receiptCell(receipts: readonly ExportReceipt[]): ExportCell {
  const paths = receipts.map((receipt) => `${receipt.folder}/${receipt.fileName}`)
  const [first, ...more] = paths
  if (first === undefined) return t('taxExport.noReceipt')
  return more.length === 0 ? { link: first, text: first } : paths.join('\n')
}

/** The title lines of a sheet: its heading, then when and how it was made. */
function sheetTitle(heading: ExportKind | 'totals', { year, createdOn }: SheetContext): string[] {
  return [
    t(`taxExport.headings.${heading}`, { year }),
    t('taxExport.createdOn', { date: createdOn }),
    t('taxExport.disclaimer'),
  ]
}

function sumOf(rows: readonly ExportRow[]): number {
  return rows.reduce((sum, row) => sum + row.amountCents, 0)
}

function cellsOf(row: ExportRow, index: number): ExportCell[] {
  return [
    { number: index + 1 },
    { date: row.date },
    row.entry.name,
    row.description,
    row.party,
    { amount: row.amountCents },
    row.paymentMethod === null ? null : paymentMethodLabel(row.paymentMethod),
    row.objectName,
    row.notes,
    receiptCell(row.receipts),
  ]
}

/** The sheet of the costs or of the income: one row per entry, and the total. */
export function entrySheet(kind: ExportKind, rows: readonly ExportRow[], context: SheetContext): ExportSheet {
  return {
    name: t(`taxExport.sheets.${kind}`),
    title: sheetTitle(kind, context),
    columns: [
      column('number', 6),
      column('date', 12),
      column('category', 28),
      column('description', 32),
      column(kind === 'costs' ? 'payee' : 'payer', 24),
      column('amount', 14),
      column('paymentMethod', 16),
      column('object', 20),
      column('notes', 32),
      column('receipt', 48),
    ],
    rows: rows.map(cellsOf),
    footer: [[null, null, null, t('taxExport.total'), null, { amount: sumOf(rows) }]],
  }
}

/** Count and sum per category, in the order the rows come. */
function categoryLines(rows: readonly ExportRow[]): ExportCell[][] {
  const groups = new Map<ExportEntry, ExportRow[]>()
  for (const row of rows) groups.set(row.entry, [...(groups.get(row.entry) ?? []), row])
  return [...groups].map(([entry, members]) => totalLine(entry.name, members))
}

function totalLine(label: string, rows: readonly ExportRow[]): ExportCell[] {
  return [label, { number: rows.length }, { amount: sumOf(rows) }]
}

/**
 * Totals per category: the costs, then the income. With both, each part starts with
 * a heading row, and the footer has a total for each.
 */
export function totalsSheet(
  costRows: readonly ExportRow[],
  incomeRows: readonly ExportRow[],
  context: SheetContext,
): ExportSheet {
  const both = context.includeCosts && context.includeIncome
  const only = context.includeCosts ? costRows : incomeRows
  return {
    name: t('taxExport.sheets.totals'),
    title: sheetTitle('totals', context),
    columns: [column('category', 32), column('count', 10), column('amount', 16)],
    rows: both
      ? [
          [t('taxExport.sheets.costs')],
          ...categoryLines(costRows),
          [],
          [t('taxExport.sheets.income')],
          ...categoryLines(incomeRows),
        ]
      : categoryLines(only),
    footer: both
      ? [totalLine(t('taxExport.totalCosts'), costRows), totalLine(t('taxExport.totalIncome'), incomeRows)]
      : [totalLine(t('taxExport.total'), only)],
  }
}
