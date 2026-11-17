import { isValidIsoDate } from '@/utils/date'
import { normaliseText } from '@/utils/text'

/** The kinds of value an attribute can hold. Must match the CHECK in migration 0003. */
export const ATTRIBUTE_VALUE_TYPES = ['text', 'number', 'date', 'boolean'] as const

export type AttributeValueType = (typeof ATTRIBUTE_VALUE_TYPES)[number]

export const ATTRIBUTE_VALUE_TYPE_LABELS: Readonly<Record<AttributeValueType, string>> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  boolean: 'Yes / No',
}

/**
 * A user-defined attribute of a household object, e.g. "Power" = 12.5 kW.
 *
 * `value` is stored as canonical text for its type:
 * text as entered · number `'12.5'` · date `'YYYY-MM-DD'` · boolean `'1'` / `'0'`.
 */
export interface HouseholdObjectAttribute {
  id: number
  objectId: number
  name: string
  valueType: AttributeValueType
  /** null = no value entered yet. */
  value: string | null
  /** Only for numbers, e.g. 'kW'. */
  unit: string | null
  sortOrder: number
}

/** One attribute row while it is edited in the object form (all values as input text). */
export interface HouseholdObjectAttributeDraft {
  /** Stable key for v-for while rows are added and removed. */
  key: number
  name: string
  valueType: AttributeValueType
  /** Boolean rows use '1' / '0'. */
  value: string
  unit: string
}

/** One attribute as passed to the service. The list order is the display order. */
export interface HouseholdObjectAttributeInput {
  name: string
  valueType: AttributeValueType
  value?: string | null
  unit?: string | null
}

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/

/**
 * One attribute, validated, with its value in canonical text form (value object).
 * Only `from()` / `listFrom()` can create one.
 */
export class HouseholdObjectAttributeValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'HouseholdObjectAttributeValues'

  private constructor(
    readonly name: string,
    readonly valueType: AttributeValueType,
    /** Canonical text for `valueType`; null = no value entered yet. */
    readonly value: string | null,
    /** Only for numbers. */
    readonly unit: string | null,
  ) {}

  /**
   * Canonical form of a number typed by the user: `' 12,5 '` → `'12.5'`.
   * Returns null if the text is not a plain decimal number.
   */
  static normaliseNumber(text: string): string | null {
    const value = text.trim().replace(',', '.')
    return NUMBER_PATTERN.test(value) ? value : null
  }

  /** Checks one attribute. Throws an error that names the attribute. */
  static from(input: HouseholdObjectAttributeInput): HouseholdObjectAttributeValues {
    const name = input.name.trim()
    if (name.length === 0) throw new Error('Every attribute needs a name.')
    if (!ATTRIBUTE_VALUE_TYPES.includes(input.valueType)) {
      throw new Error(`"${name}" has an unknown type.`)
    }
    return new HouseholdObjectAttributeValues(
      name,
      input.valueType,
      HouseholdObjectAttributeValues.canonicalValue(name, input.valueType, input.value),
      input.valueType === 'number' ? normaliseText(input.unit) : null,
    )
  }

  /** Checks the attribute list of one object: each attribute, and names unique (ignoring case). */
  static listFrom(inputs: readonly HouseholdObjectAttributeInput[]): HouseholdObjectAttributeValues[] {
    const seen = new Set<string>()
    return inputs.map((input) => {
      const attribute = HouseholdObjectAttributeValues.from(input)
      const key = attribute.name.toLowerCase()
      if (seen.has(key)) throw new Error(`The attribute "${attribute.name}" is listed twice.`)
      seen.add(key)
      return attribute
    })
  }

  private static canonicalValue(
    name: string,
    valueType: AttributeValueType,
    raw: string | null | undefined,
  ): string | null {
    const value = normaliseText(raw)
    if (value === null) return null
    switch (valueType) {
      case 'text':
        return value
      case 'number': {
        const number = HouseholdObjectAttributeValues.normaliseNumber(value)
        if (number === null) throw new Error(`"${name}" must be a number.`)
        return number
      }
      case 'date':
        if (!isValidIsoDate(value)) throw new Error(`"${name}" is not a valid date.`)
        return value
      case 'boolean':
        if (value !== '1' && value !== '0') throw new Error(`"${name}" must be yes or no.`)
        return value
    }
  }
}
