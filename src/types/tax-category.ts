import { t } from '@/i18n'

/**
 * A user-defined tax category, e.g. "Handwerkerleistungen". It only groups costs
 * for the export to a tax advisor; HomeBase attaches no tax rules to it.
 */
export interface TaxCategory {
  id: number
  name: string
  /** true: costs of this category ask for their labour share (e.g. tradesman services). */
  recordsLabourCost: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** User-editable fields of a tax category. */
export interface TaxCategoryInput {
  name: string
  recordsLabourCost: boolean
}

/**
 * The list a new installation starts with ("Add default categories" restores it).
 * A frozen copy is the seed data of migration 0009. German names: the export is
 * meant for a German tax advisor. Taxes and fees are no category: they are the
 * cost type 'tax' (see `taxGroupOf` in cost.ts).
 */
export const DEFAULT_TAX_CATEGORIES: readonly TaxCategoryInput[] = [
  { name: 'Haushaltsnahe Dienstleistungen', recordsLabourCost: true },
  { name: 'Handwerkerleistungen', recordsLabourCost: true },
  { name: 'Arbeitszimmer / Homeoffice', recordsLabourCost: false },
  { name: 'Versicherungen', recordsLabourCost: false },
  { name: 'Spenden', recordsLabourCost: false },
  { name: 'Krankheitskosten', recordsLabourCost: false },
  { name: 'Kinderbetreuung', recordsLabourCost: false },
  { name: 'Sonstiges', recordsLabourCost: false },
]

/** The fields of a tax category, validated and normalised (value object). Only `from()` can create one. */
export class TaxCategoryValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'TaxCategoryValues'

  private constructor(
    readonly name: string,
    readonly recordsLabourCost: boolean,
  ) {}

  /** Trims the name. Throws an error with a readable message. */
  static from(input: TaxCategoryInput): TaxCategoryValues {
    const name = input.name.trim()
    if (name.length === 0) throw new Error(t('errors.taxCategory.nameRequired'))
    return new TaxCategoryValues(name, input.recordsLabourCost)
  }
}
