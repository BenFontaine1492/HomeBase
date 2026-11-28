import { t } from '@/i18n'
import type { Attachment } from './attachment'
import { groupsByCategory } from './category'
import { sumOfCosts, taxYearOf, type Cost } from './cost'
import { incomeYearOf, sumOfIncome, type Income } from './income'
import {
  entrySheet,
  totalsSheet,
  type ExportEntry,
  type ExportReceipt,
  type ExportRow,
  type ExportSheet,
  type SheetContext,
} from './tax-export-sheets'

export type { ExportCell, ExportColumn, ExportReceipt, ExportSheet } from './tax-export-sheets'

/*
 * The export for a tax advisor, as a plan the native side carries out
 * (src-tauri/src/tax_export): a new folder with a workbook of the costs and the
 * income of a year, by category, and their receipts in one subfolder per category
 * (income: inside the income folder, "Einnahmen/Photovoltaik"), named after the row
 * they belong to ("002_2026-03-02_Müller.pdf"). The sheets are built in
 * tax-export-sheets.ts.
 * Pure: the texts are translated here, the data comes in as parameters.
 */

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
  costTotalCents: number
  incomeCount: number
  incomeTotalCents: number
  receiptCount: number
  /** Cost and income rows without a receipt. */
  withoutReceiptCount: number
}

/** What the user selects in the export dialog. */
export interface TaxExportSelection {
  year: number
  /** All costs of the year. */
  includeCosts: boolean
  /** All income of the year. */
  includeIncome: boolean
}

export interface TaxExportInput extends TaxExportSelection {
  costs: readonly Cost[]
  income: readonly Income[]
  attachments: readonly Attachment[]
  /** What a cost was for (its description, or its maintenance work). */
  titleOf: (cost: Cost) => string
  objectNameOf: (objectId: number | null) => string | null
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

/** A folder name from `name` that is not in `used` yet (ignoring case); adds it there. */
function uniqueFolder(name: string, used: Set<string>): string {
  const base = safeName(name, t('taxExport.categoryFallback'))
  let folder = base
  for (let n = 2; used.has(folder.toLowerCase()); n += 1) folder = `${base} (${n})`
  used.add(folder.toLowerCase())
  return folder
}

/** The folder of the income receipts, next to the cost folders. */
function incomeRoot(): string {
  return safeName(t('taxExport.incomeFolder'), t('taxExport.categoryFallback'))
}

/** What grouping reads of a cost or an income entry. */
interface Dated {
  id: number
  /** 'YYYY-MM-DD' */
  date: string
  category: string | null
}

function byDate(a: Dated, b: Dated): number {
  return a.date.localeCompare(b.date) || a.id - b.id
}

/**
 * `items` by category (alphabetically, those without one last), then by date. Each
 * category gets its own folder (inside `root`, if given); no two share one.
 */
function inCategories<T extends Dated>(
  items: readonly T[],
  root: string | null,
  used: Set<string>,
): { item: T; entry: ExportEntry }[] {
  return groupsByCategory(items).flatMap(({ label, entries }) => {
    const folder = uniqueFolder(label, used)
    const entry: ExportEntry = { name: label, folder: root === null ? folder : `${root}/${folder}` }
    // A fresh array from filter() (groupsByCategory); toSorted() needs lib ES2023 (tsconfig has ES2022).
    // oxlint-disable-next-line unicorn/no-array-sort
    return entries.sort(byDate).map((item) => ({ item, entry }))
  })
}

/** The costs of the export: all of `year`, by category, then by date. */
export function exportedCosts(input: TaxExportInput): { cost: Cost; entry: ExportEntry }[] {
  if (!input.includeCosts) return []
  // The cost folders sit next to the income folder: they never take its name.
  const used = new Set(input.includeIncome ? [incomeRoot().toLowerCase()] : [])
  const ofYear = input.costs.filter((cost) => taxYearOf(cost) === input.year)
  const dated = ofYear.map((cost) => ({ id: cost.id, date: cost.paidDate, category: cost.category, cost }))
  return inCategories(dated, null, used).map(({ item, entry }) => ({ cost: item.cost, entry }))
}

/** The income of the export: all of `year`, by category, then by date, inside the income folder. */
export function exportedIncome(input: TaxExportInput): { income: Income; entry: ExportEntry }[] {
  if (!input.includeIncome) return []
  const ofYear = input.income.filter((income) => incomeYearOf(income) === input.year)
  const dated = ofYear.map((income) => ({
    id: income.id,
    date: income.receivedDate,
    category: income.category,
    income,
  }))
  return inCategories(dated, incomeRoot(), new Set()).map(({ item, entry }) => ({ income: item.income, entry }))
}

/** Oldest first. */
function byId(a: Attachment, b: Attachment): number {
  return a.id - b.id
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
      .sort(byId)
  )
}

/** The documents of an income entry, oldest first. */
export function receiptsOfIncome(income: Income, attachments: readonly Attachment[]): Attachment[] {
  // A fresh array from filter(); toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  return attachments.filter(({ owner }) => owner.kind === 'income' && owner.id === income.id).sort(byId)
}

/** `attachments` as the files of row `index` (0-based) of its sheet: "002_2026-03-02_Müller.pdf", "…_2.pdf", … */
function receiptFiles(
  attachments: readonly Attachment[],
  index: number,
  row: Omit<ExportRow, 'receipts'>,
): ExportReceipt[] {
  const number = String(index + 1).padStart(3, '0')
  const label = safeName(row.party ?? row.description, t('taxExport.receiptFallback'))
  return attachments.map((attachment, position) => ({
    attachmentId: attachment.id,
    folder: row.entry.folder,
    fileName: `${number}_${row.date}_${label}${position === 0 ? '' : `_${position + 1}`}${extensionOf(attachment.storedName)}`,
  }))
}

function withReceipts(row: Omit<ExportRow, 'receipts'>, index: number, attachments: readonly Attachment[]): ExportRow {
  return { ...row, receipts: receiptFiles(attachments, index, row) }
}

function costRows(input: TaxExportInput): ExportRow[] {
  return exportedCosts(input).map(({ cost, entry }, index) =>
    withReceipts(
      {
        entry,
        date: cost.paidDate,
        description: input.titleOf(cost),
        party: cost.payee,
        amountCents: cost.amountCents,
        paymentMethod: cost.paymentMethod,
        objectName: input.objectNameOf(cost.objectId),
        notes: cost.notes,
      },
      index,
      receiptsOf(cost, input.attachments),
    ),
  )
}

function incomeRows(input: TaxExportInput): ExportRow[] {
  return exportedIncome(input).map(({ income, entry }, index) =>
    withReceipts(
      {
        entry,
        date: income.receivedDate,
        description: income.description,
        party: income.payer,
        amountCents: income.amountCents,
        paymentMethod: income.paymentMethod,
        objectName: input.objectNameOf(income.householdObjectId),
        notes: income.notes,
      },
      index,
      receiptsOfIncome(income, input.attachments),
    ),
  )
}

/** The workbook is named after what it contains. */
function workbookName({ includeCosts, includeIncome, year }: TaxExportInput): string {
  if (includeCosts && includeIncome) return t('taxExport.workbookNames.both', { year })
  return t(includeIncome ? 'taxExport.workbookNames.income' : 'taxExport.workbookNames.costs', { year })
}

/** The plan of the export, and what it contains. */
export function buildTaxExport(
  input: TaxExportInput,
  formats: TaxExportFormats,
): { plan: TaxExportPlan; summary: TaxExportSummary } {
  const costs = costRows(input)
  const income = incomeRows(input)
  const context: SheetContext = {
    year: input.year,
    includeCosts: input.includeCosts,
    includeIncome: input.includeIncome,
    createdOn: formats.createdOn,
  }
  const rows = [...costs, ...income]
  const receipts = rows.flatMap((row) => row.receipts)
  return {
    plan: {
      folderName: t('taxExport.folderName', { year: input.year }),
      workbookName: `${workbookName(input)}.xlsx`,
      currencyFormat: formats.currencyFormat,
      dateFormat: formats.dateFormat,
      sheets: [
        ...(input.includeCosts ? [entrySheet('costs', costs, context)] : []),
        ...(input.includeIncome ? [entrySheet('income', income, context)] : []),
        totalsSheet(costs, income, context),
      ],
      receipts,
    },
    summary: {
      costCount: costs.length,
      costTotalCents: sumOfCosts(costs),
      incomeCount: income.length,
      incomeTotalCents: sumOfIncome(income),
      receiptCount: receipts.length,
      withoutReceiptCount: rows.filter((row) => row.receipts.length === 0).length,
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
