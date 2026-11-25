import { t } from '@/i18n'
import type { Attachment } from './attachment'
import {
  costTypeLabel,
  paymentMethodLabel,
  sumOfCosts,
  TAXES,
  taxesGroupLabel,
  taxGroupOf,
  taxYearOf,
  type Cost,
  type TaxGroup,
} from './cost'
import type { TaxCategory } from './tax-category'

/*
 * The export for a tax advisor, as a plan the native side carries out
 * (src-tauri/src/tax_export): a new folder with a workbook of the costs in the
 * selected groups (tax categories, and the taxes and fees, see `taxGroupOf`), and
 * their receipts in one subfolder per group, named after the row they belong to
 * ("002_2026-03-02_Müller.pdf").
 * Pure: the texts are translated here, the data comes in as parameters.
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

/** Attachment `attachmentId` is copied to `<folder>/<fileName>`. */
export interface ExportReceipt {
  attachmentId: number
  folder: string
  fileName: string
}

export interface TaxExportPlan {
  folderName: string
  workbookName: string
  /** Excel number formats (utils/excel-format.ts). */
  currencyFormat: string
  dateFormat: string
  sheets: ExportSheet[]
  receipts: ExportReceipt[]
}

/** What the export contains, for the dialog. */
export interface TaxExportSummary {
  costCount: number
  receiptCount: number
  withoutReceiptCount: number
  totalCents: number
}

/** A group the export can include: a tax category id, or TAXES. */
export type ExportGroup = Exclude<TaxGroup, null>

export interface TaxExportInput {
  year: number
  /** The groups to include. */
  groups: readonly ExportGroup[]
  costs: readonly Cost[]
  categories: readonly TaxCategory[]
  attachments: readonly Attachment[]
  /** What a cost was for (its description, or its maintenance work). */
  titleOf: (cost: Cost) => string
  objectNameOf: (cost: Cost) => string | null
}

export interface TaxExportFormats {
  /** The creation date, formatted for the heading. */
  createdOn: string
  currencyFormat: string
  dateFormat: string
}

/** Longest file or folder name part taken from user text (the native side allows 120). */
const MAX_NAME_PART = 60
/** Names Windows reserves for devices, also with an extension. */
const RESERVED_NAMES = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i

/**
 * `text` as one file or folder name that works on every system: no path separators
 * or other forbidden characters, no leading dots, no trailing dots or spaces.
 */
export function safeName(text: string, fallback: string): string {
  const cleaned = text
    .replaceAll(/[/\\]/g, '-')
    // Line breaks and tabs become spaces first; other control characters are not allowed.
    .replaceAll(/\s+/g, ' ')
    // oxlint-disable-next-line no-control-regex
    .replaceAll(/[:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, MAX_NAME_PART)
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
  if (cleaned === '') return fallback
  return RESERVED_NAMES.test(cleaned) ? `${cleaned}_` : cleaned
}

/** The extension of a stored file name (`.pdf`); stored names are always safe (a–z, 0–9). */
function extensionOf(storedName: string): string {
  return /\.[a-z0-9]{1,10}$/.exec(storedName)?.[0] ?? ''
}

/** A selected group and its folder in the export. */
interface ExportEntry {
  group: ExportGroup
  name: string
  recordsLabourCost: boolean
  folder: string
  /** Position in the list of groups (the order of the rows). */
  order: number
}

/** The tax categories in their order, then the taxes and fees. */
function allGroups(categories: readonly TaxCategory[]): Omit<ExportEntry, 'folder' | 'order'>[] {
  return [
    ...categories.map((category) => ({
      group: category.id,
      name: category.name,
      recordsLabourCost: category.recordsLabourCost,
    })),
    { group: TAXES, name: taxesGroupLabel(), recordsLabourCost: false },
  ]
}

/** The selected groups with one folder name each; two groups never share one. */
function exportEntries(input: TaxExportInput): ExportEntry[] {
  const used = new Set<string>()
  return allGroups(input.categories).flatMap((entry, order): ExportEntry[] => {
    if (!input.groups.includes(entry.group)) return []
    const base = safeName(entry.name, t('taxExport.categoryFallback'))
    let folder = base
    for (let n = 2; used.has(folder.toLowerCase()); n += 1) folder = `${base} (${n})`
    used.add(folder.toLowerCase())
    return [{ ...entry, folder, order }]
  })
}

interface ExportedCost {
  cost: Cost
  entry: ExportEntry
}

function byCategoryThenDate(a: ExportedCost, b: ExportedCost): number {
  return a.entry.order - b.entry.order || a.cost.paidDate.localeCompare(b.cost.paidDate) || a.cost.id - b.cost.id
}

/** The costs of the export: of `year`, in a selected group; in the groups' order, then by date. */
export function exportedCosts(input: TaxExportInput): ExportedCost[] {
  const entries = exportEntries(input)
  const costs = input.costs.flatMap((cost): ExportedCost[] => {
    const group = taxGroupOf(cost)
    const entry = entries.find((candidate) => candidate.group === group)
    return entry && taxYearOf(cost) === input.year ? [{ cost, entry }] : []
  })
  // A fresh array from flatMap(); toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  return costs.sort(byCategoryThenDate)
}

/** The receipts of a cost: its own documents, and those of its maintenance record. */
export function receiptsOf(cost: Cost, attachments: readonly Attachment[]): Attachment[] {
  return (
    attachments
      .filter(
        ({ owner }) =>
          (owner.kind === 'cost' && owner.id === cost.id) ||
          (owner.kind === 'maintenance-record' && owner.id === cost.maintenanceRecordId),
      )
      // A fresh array from filter(); toSorted() needs lib ES2023 (tsconfig has ES2022).
      // oxlint-disable-next-line unicorn/no-array-sort
      .sort((a, b) => a.id - b.id)
  )
}

/** The receipts of row `index` (0-based) as files of the export. */
function receiptFiles(cost: Cost, index: number, folder: string, input: TaxExportInput): ExportReceipt[] {
  const number = String(index + 1).padStart(3, '0')
  const label = safeName(cost.payee ?? input.titleOf(cost), t('taxExport.receiptFallback'))
  return receiptsOf(cost, input.attachments).map((attachment, position) => ({
    attachmentId: attachment.id,
    folder,
    fileName: `${number}_${cost.paidDate}_${label}${position === 0 ? '' : `_${position + 1}`}${extensionOf(attachment.storedName)}`,
  }))
}

function receiptCell(receipts: readonly ExportReceipt[]): ExportCell {
  const paths = receipts.map((receipt) => `${receipt.folder}/${receipt.fileName}`)
  const [first, ...more] = paths
  if (first === undefined) return t('taxExport.noReceipt')
  return more.length === 0 ? { link: first, text: first } : paths.join('\n')
}

interface ExportRow {
  cost: Cost
  entry: ExportEntry
  receipts: ExportReceipt[]
}

function column(key: ColumnKey, width: number): ExportColumn {
  return { label: columnLabel(key), width }
}

function costColumns(withLabour: boolean): ExportColumn[] {
  return [
    column('number', 6),
    column('date', 12),
    column('category', 28),
    column('description', 32),
    column('payee', 24),
    column('type', 16),
    column('amount', 14),
    ...(withLabour ? [column('labour', 16)] : []),
    column('paymentMethod', 16),
    column('object', 20),
    column('notes', 32),
    column('receipt', 48),
  ]
}

type ColumnKey =
  | 'number'
  | 'date'
  | 'category'
  | 'description'
  | 'payee'
  | 'type'
  | 'amount'
  | 'labour'
  | 'paymentMethod'
  | 'object'
  | 'notes'
  | 'receipt'
  | 'count'

function columnLabel(key: ColumnKey): string {
  return t(`taxExport.columns.${key}`)
}

function costRow(row: ExportRow, index: number, withLabour: boolean, input: TaxExportInput): ExportCell[] {
  const { cost } = row
  return [
    { number: index + 1 },
    { date: cost.paidDate },
    row.entry.name,
    input.titleOf(cost),
    cost.payee,
    costTypeLabel(cost.costType),
    { amount: cost.amountCents },
    ...(withLabour ? [cost.labourCents === null ? null : { amount: cost.labourCents }] : []),
    cost.paymentMethod === null ? null : paymentMethodLabel(cost.paymentMethod),
    input.objectNameOf(cost),
    cost.notes,
    receiptCell(row.receipts),
  ]
}

function labourOf(costs: readonly Cost[]): number {
  return costs.reduce((sum, cost) => sum + (cost.labourCents ?? 0), 0)
}

function costSheet(
  rows: readonly ExportRow[],
  withLabour: boolean,
  input: TaxExportInput,
  title: string[],
): ExportSheet {
  const costs = rows.map((row) => row.cost)
  const labour: ExportCell[] = withLabour ? [{ amount: labourOf(costs) }] : []
  return {
    name: t('taxExport.sheets.costs'),
    title,
    columns: costColumns(withLabour),
    rows: rows.map((row, index) => costRow(row, index, withLabour, input)),
    footer: [[null, null, null, t('taxExport.total'), null, null, { amount: sumOfCosts(costs) }, ...labour]],
  }
}

function totalsSheet(rows: readonly ExportRow[], withLabour: boolean, title: string[]): ExportSheet {
  const entries = [...new Set(rows.map((row) => row.entry))]
  const line = (label: string, costs: readonly Cost[]): ExportCell[] => [
    label,
    { number: costs.length },
    { amount: sumOfCosts(costs) },
    ...(withLabour ? [{ amount: labourOf(costs) }] : []),
  ]
  const costsOf = (entry: ExportEntry): Cost[] => rows.filter((row) => row.entry === entry).map((row) => row.cost)
  return {
    name: t('taxExport.sheets.totals'),
    title,
    columns: [
      column('category', 32),
      column('count', 10),
      column('amount', 16),
      ...(withLabour ? [column('labour', 18)] : []),
    ],
    rows: entries.map((entry) => line(entry.name, costsOf(entry))),
    footer: [
      line(
        t('taxExport.total'),
        rows.map((row) => row.cost),
      ),
    ],
  }
}

/** The plan of the export, and what it contains. */
export function buildTaxExport(
  input: TaxExportInput,
  formats: TaxExportFormats,
): { plan: TaxExportPlan; summary: TaxExportSummary } {
  const rows = exportedCosts(input).map(({ cost, entry }, index): ExportRow => ({
    cost,
    entry,
    receipts: receiptFiles(cost, index, entry.folder, input),
  }))
  const withLabour = rows.some((row) => row.entry.recordsLabourCost)
  const title = [
    t('taxExport.heading', { year: input.year }),
    t('taxExport.createdOn', { date: formats.createdOn }),
    t('taxExport.disclaimer'),
  ]
  const receipts = rows.flatMap((row) => row.receipts)
  return {
    plan: {
      folderName: t('taxExport.folderName', { year: input.year }),
      workbookName: `${t('taxExport.workbookName', { year: input.year })}.xlsx`,
      currencyFormat: formats.currencyFormat,
      dateFormat: formats.dateFormat,
      sheets: [costSheet(rows, withLabour, input, title), totalsSheet(rows, withLabour, title)],
      receipts,
    },
    summary: {
      costCount: rows.length,
      receiptCount: receipts.length,
      withoutReceiptCount: rows.filter((row) => row.receipts.length === 0).length,
      totalCents: sumOfCosts(rows.map((row) => row.cost)),
    },
  }
}

/** What the native side did (src-tauri/src/tax_export). */
export interface TaxExportResult {
  /** The new folder. */
  folder: string
  /** How many receipt files were copied. */
  copied: number
  /** Receipts (`folder/file`) whose file is missing in HomeBase, so they were not copied. */
  missing: string[]
}
