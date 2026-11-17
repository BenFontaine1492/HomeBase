import { normaliseText } from '@/utils/text'

/** A user-defined inventory category such as "Heating" or "Energy". */
export interface HouseholdCategory {
  id: number
  name: string
  /** MDI icon name, one of `CATEGORY_ICONS`. */
  icon: string
  description: string | null
  createdAt: string
  updatedAt: string
}

/** User-editable fields of a category, used for both creating and updating. */
export interface HouseholdCategoryInput {
  name: string
  icon: string
  description?: string | null
}

export interface CategoryIconOption {
  icon: string
  label: string
}

/** Curated icons offered in the category form. */
export const CATEGORY_ICONS: readonly CategoryIconOption[] = [
  { icon: 'mdi-radiator', label: 'Heating' },
  { icon: 'mdi-fire', label: 'Fire / stove' },
  { icon: 'mdi-water-boiler', label: 'Boiler' },
  { icon: 'mdi-air-conditioner', label: 'Air conditioning' },
  { icon: 'mdi-solar-power-variant', label: 'Solar' },
  { icon: 'mdi-lightning-bolt-outline', label: 'Electricity' },
  { icon: 'mdi-lightbulb-outline', label: 'Lighting' },
  { icon: 'mdi-water-pump', label: 'Water' },
  { icon: 'mdi-shower-head', label: 'Bathroom' },
  { icon: 'mdi-washing-machine', label: 'Laundry' },
  { icon: 'mdi-fridge-outline', label: 'Kitchen appliances' },
  { icon: 'mdi-silverware-fork-knife', label: 'Kitchen' },
  { icon: 'mdi-sofa-outline', label: 'Furniture' },
  { icon: 'mdi-bed-outline', label: 'Bedroom' },
  { icon: 'mdi-television', label: 'Entertainment' },
  { icon: 'mdi-laptop', label: 'Computers' },
  { icon: 'mdi-router-wireless', label: 'Network' },
  { icon: 'mdi-shield-home-outline', label: 'Security' },
  { icon: 'mdi-flower-outline', label: 'Garden' },
  { icon: 'mdi-car-outline', label: 'Car' },
  { icon: 'mdi-bicycle', label: 'Bicycle' },
  { icon: 'mdi-tools', label: 'Tools' },
  { icon: 'mdi-hammer-wrench', label: 'Workshop' },
  { icon: 'mdi-toolbox-outline', label: 'Miscellaneous' },
]

export const DEFAULT_CATEGORY_ICON = 'mdi-toolbox-outline'

/** Icon and label used for objects without a category. */
export const UNCATEGORIZED_LABEL = 'No category assigned'
export const UNCATEGORIZED_ICON = 'mdi-tag-off-outline'

export interface DeleteCategoryOptions {
  /** true: delete the assigned objects too. false: keep them without a category. */
  deleteObjects: boolean
}

/**
 * The editable fields of a category, validated and normalised (value object).
 * Only `HouseholdCategoryValues.from()` can create one.
 */
export class HouseholdCategoryValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'HouseholdCategoryValues'

  private constructor(
    readonly name: string,
    /** One of `CATEGORY_ICONS`. */
    readonly icon: string,
    readonly description: string | null,
  ) {}

  /** Checks the form input and trims it. Throws an error with a readable message. */
  static from(input: HouseholdCategoryInput): HouseholdCategoryValues {
    const name = input.name.trim()
    if (name.length === 0) {
      throw new Error('A category needs a name.')
    }
    if (!CATEGORY_ICONS.some((option) => option.icon === input.icon)) {
      throw new Error(`Unknown icon "${input.icon}".`)
    }
    return new HouseholdCategoryValues(name, input.icon, normaliseText(input.description))
  }
}
