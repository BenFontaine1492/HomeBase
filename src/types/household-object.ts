import { HouseholdObjectAttributeValues, type HouseholdObjectAttributeInput } from './household-object-attribute'
import { t } from '@/i18n'
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
      throw new Error(t('errors.object.nameRequired'))
    }
    if (input.categoryId !== null && !Number.isSafeInteger(input.categoryId)) {
      throw new Error(t('errors.object.invalidCategory'))
    }
    const price = input.purchasePriceCents
    if (price != null && (!Number.isSafeInteger(price) || price < 0)) {
      throw new Error(t('errors.object.invalidPrice'))
    }
    for (const [message, value] of [
      ['errors.object.invalidPurchaseDate', input.purchaseDate],
      ['errors.object.invalidInstallationDate', input.installationDate],
    ] as const) {
      const date = normaliseText(value)
      if (date !== null && !isValidIsoDate(date)) {
        throw new Error(t(message))
      }
    }
    return new HouseholdObjectValues(input, HouseholdObjectAttributeValues.listFrom(attributes))
  }
}

/**
 * How closely two object names match:
 * - `'exact'`: the same after trimming, ignoring case ("Heat pump" = "heat pump ").
 * - `'near'`: the same ignoring spaces, punctuation and accents ("Heatpump" ≈ "Heat-pump"),
 *   or one typo apart ("Radiater" ≈ "Radiator"; names of at least 5 letters, same numbers).
 */
export type ObjectNameMatch = 'exact' | 'near'

/** Shorter names differ by one letter too easily ("Lamp" / "Lump"), so typos only count from this length. */
const TYPO_MIN_LENGTH = 5

/** Compares a new name with an existing one; null = no match. Never matches an empty name. */
export function matchObjectNames(name: string, existingName: string): ObjectNameMatch | null {
  const a = name.trim().toLowerCase()
  const b = existingName.trim().toLowerCase()
  if (a === '') return null
  if (a === b) return 'exact'
  const compactA = compactName(a)
  const compactB = compactName(b)
  if (compactA === '') return null
  return compactA === compactB || isTypo(compactA, compactB) ? 'near' : null
}

/** Without accents, spaces and punctuation: "heat-pump é" → "heatpumpe". */
function compactName(name: string): string {
  return name.normalize('NFD').replaceAll(/[^\p{L}\p{N}]/gu, '')
}

/** One letter added, removed or replaced, with the same numbers ("Radiator 1" / "Radiator 2" are different objects). */
function isTypo(a: string, b: string): boolean {
  return (
    Math.min(a.length, b.length) >= TYPO_MIN_LENGTH &&
    a.replaceAll(/\D/gu, '') === b.replaceAll(/\D/gu, '') &&
    isOneEditApart(a, b)
  )
}

/** True if `a` and `b` (which differ) are one insertion, deletion or substitution apart. */
function isOneEditApart(a: string, b: string): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  if (longer.length - shorter.length > 1) return false
  let start = 0
  while (shorter[start] === longer[start]) start++
  const skip = shorter.length === longer.length ? 1 : 0
  return shorter.slice(start + skip) === longer.slice(start + 1)
}
