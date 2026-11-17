import { HouseholdObjectAttributeValues, type HouseholdObjectAttributeInput } from './household-object-attribute'
import { isValidIsoDate } from '@/utils/date'
import { normaliseText } from '@/utils/text'

/** A household object (appliance, device, furniture, …) in the inventory. */
export interface HouseholdObject {
  id: number
  name: string
  /** null = "No category assigned". */
  categoryId: number | null
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  /** 'YYYY-MM-DD' */
  purchaseDate: string | null
  /** Purchase price in cents (integer). */
  purchasePriceCents: number | null
  /** 'YYYY-MM-DD' */
  installationDate: string | null
  location: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** User-editable fields of an object, used for both creating and updating. */
export interface HouseholdObjectInput {
  name: string
  categoryId: number | null
  manufacturer?: string | null
  model?: string | null
  serialNumber?: string | null
  purchaseDate?: string | null
  purchasePriceCents?: number | null
  installationDate?: string | null
  location?: string | null
  notes?: string | null
}

/**
 * The editable fields of an object plus its attribute list, validated and
 * normalised (value object). Only `HouseholdObjectValues.from()` can create one.
 */
export class HouseholdObjectValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'HouseholdObjectValues'

  readonly name: string
  readonly categoryId: number | null
  readonly manufacturer: string | null
  readonly model: string | null
  readonly serialNumber: string | null
  /** 'YYYY-MM-DD' */
  readonly purchaseDate: string | null
  /** Integer cents, never negative. */
  readonly purchasePriceCents: number | null
  /** 'YYYY-MM-DD' */
  readonly installationDate: string | null
  readonly location: string | null
  readonly notes: string | null
  /** In display order; names unique (ignoring case). */
  readonly attributes: readonly HouseholdObjectAttributeValues[]

  private constructor(input: HouseholdObjectInput, attributes: readonly HouseholdObjectAttributeValues[]) {
    this.name = input.name.trim()
    this.categoryId = input.categoryId
    this.manufacturer = normaliseText(input.manufacturer)
    this.model = normaliseText(input.model)
    this.serialNumber = normaliseText(input.serialNumber)
    this.purchaseDate = normaliseText(input.purchaseDate)
    this.purchasePriceCents = input.purchasePriceCents ?? null
    this.installationDate = normaliseText(input.installationDate)
    this.location = normaliseText(input.location)
    this.notes = normaliseText(input.notes)
    this.attributes = attributes
  }

  /** Checks the form input and its attributes, and trims them. Throws an error with a readable message. */
  static from(
    input: HouseholdObjectInput,
    attributes: readonly HouseholdObjectAttributeInput[],
  ): HouseholdObjectValues {
    if (input.name.trim().length === 0) {
      throw new Error('An object needs a name.')
    }
    if (input.categoryId !== null && !Number.isSafeInteger(input.categoryId)) {
      throw new Error('Invalid category.')
    }
    const price = input.purchasePriceCents
    if (price != null && (!Number.isSafeInteger(price) || price < 0)) {
      throw new Error('The purchase price must be a non-negative amount.')
    }
    for (const [label, value] of [
      ['purchase date', input.purchaseDate],
      ['installation date', input.installationDate],
    ] as const) {
      const date = normaliseText(value)
      if (date !== null && !isValidIsoDate(date)) {
        throw new Error(`The ${label} is not a valid date.`)
      }
    }
    return new HouseholdObjectValues(input, HouseholdObjectAttributeValues.listFrom(attributes))
  }
}
